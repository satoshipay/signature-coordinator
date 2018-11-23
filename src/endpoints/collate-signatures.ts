import createError from "http-errors"
import { Server, Transaction } from "stellar-sdk"

import { database, transaction } from "../database"
import { notifySignatureRequestSubmitted, notifySignatureRequestUpdated } from "../notifications"
import { parseRequestURI, patchSignatureRequestURIParameters } from "../lib/sep-0007"
import {
  collateTransactionSignatures,
  getHorizon,
  hasSufficientSignatures,
  networkPassphrases,
  selectStellarNetwork,
  signatureMatchesPublicKey
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
  const inputTx = new Transaction(txXDR)
  const signatureRequest = await querySignatureRequestByHash(database, signatureRequestHash)

  if (!signatureRequest) {
    throw createError(404, `Signature request not found: ${signatureRequestHash}`)
  }

  const signatureRequestParams = parseRequestURI(signatureRequest.request_uri).parameters

  await selectStellarNetwork(
    signatureRequestParams.network_passphrase || networkPassphrases.mainnet
  )

  const collatedTx = collateTransactionSignatures(inputTx, inputTx.signatures)
  const horizon = getHorizon(
    signatureRequestParams.network_passphrase || networkPassphrases.mainnet
  )

  const [sourceAccount, allSigners] = await Promise.all([
    horizon.loadAccount(collatedTx.source),
    queryAllSignatureRequestSigners(database, signatureRequest.id)
  ])

  await updateSignatureRequest(
    signatureRequest,
    collatedTx,
    allSigners.map(signer => signer.account_id)
  )
  const signers = await queryAllSignatureRequestSigners(database, signatureRequest.id)

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
