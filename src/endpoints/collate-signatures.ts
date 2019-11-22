import createError from "http-errors"
import { Networks, Server, Transaction } from "stellar-sdk"

import { database, transaction } from "../database"
import { notifySignatureRequestSubmitted, notifySignatureRequestUpdated } from "../notifications"
import { parseRequestURI, patchSignatureRequestURIParameters } from "../lib/sep-0007"
import {
  collateTransactionSignatures,
  getHorizon,
  hasSufficientSignatures,
  signatureMatchesPublicKey,
  verifySignatures
} from "../lib/stellar"
import {
  markSignatureRequestAsCompleted,
  querySignatureRequestByHash,
  updateSignatureRequestURI,
  SignatureRequest
} from "../models/signature-request"
import { queryAllSignatureRequestSigners, setSignersHasSignedFlags } from "../models/signer"

async function submitToHorizon(horizon: Server, tx: Transaction) {
  try {
    return await horizon.submitTransaction(tx)
  } catch (error) {
    const base64XDR = tx
      .toEnvelope()
      .toXDR()
      .toString("base64")

    throw createError(400, "Transaction submission to horizon failed.", {
      data: {
        response: error.response.data,
        base64XDR
      }
    })
  }
}

function txContainsSignatureOf(tx: Transaction, accountID: string) {
  return tx.signatures.some(signature => signatureMatchesPublicKey(signature, accountID))
}

async function updateSignatureRequest(
  signatureRequest: SignatureRequest,
  collatedTx: Transaction,
  allSignerAccountIDs: string[]
) {
  const updatedSignaturesAccountIDs = allSignerAccountIDs.filter(accountID =>
    txContainsSignatureOf(collatedTx, accountID)
  )

  const updatedRequestURI = patchSignatureRequestURIParameters(signatureRequest.request_uri, {
    xdr: collatedTx
      .toEnvelope()
      .toXDR()
      .toString("base64")
  })

  await transaction(async client => {
    await Promise.all([
      updateSignatureRequestURI(client, signatureRequest.id, updatedRequestURI),
      setSignersHasSignedFlags(client, signatureRequest.id, updatedSignaturesAccountIDs)
    ])
  })
}

export async function collateSignatures(signatureRequestHash: string, txXDR: string) {
  const signatureRequest = await querySignatureRequestByHash(database, signatureRequestHash)

  if (!signatureRequest) {
    throw createError(404, `Signature request not found: ${signatureRequestHash}`)
  }

  const signers = await queryAllSignatureRequestSigners(database, signatureRequest.id)
  const signerAccountIDs = signers.map(signer => signer.account_id)

  const signatureRequestParams = parseRequestURI(signatureRequest.request_uri).parameters
  const network = (signatureRequestParams.network_passphrase || Networks.PUBLIC) as Networks

  const inputTx = new Transaction(txXDR, network)

  verifySignatures(inputTx, signerAccountIDs)

  const collatedTx = collateTransactionSignatures(network, inputTx, inputTx.signatures)
  const horizon = getHorizon(network)

  const [sourceAccount, allSigners] = await Promise.all([
    horizon.loadAccount(collatedTx.source),
    queryAllSignatureRequestSigners(database, signatureRequest.id)
  ])

  await updateSignatureRequest(
    signatureRequest,
    collatedTx,
    allSigners.map(signer => signer.account_id)
  )

  await notifySignatureRequestUpdated({
    signatureRequest,
    signers
  })

  if (hasSufficientSignatures(sourceAccount, collatedTx.signatures)) {
    const submissionResponse = await submitToHorizon(horizon, collatedTx)
    await markSignatureRequestAsCompleted(database, signatureRequest.id)

    await notifySignatureRequestSubmitted({
      signatureRequest,
      signers
    })

    return {
      collatedTx,
      submissionResponse
    }
  } else {
    return {
      collatedTx,
      submissionResponse: null
    }
  }
}
