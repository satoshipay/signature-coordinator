import createError from "http-errors"
import { Server, Transaction } from "stellar-sdk"

import { database, transaction } from "../database"
import { notifySignatureRequestSubmitted, notifySignatureRequestUpdated } from "../notifications"
import { parseRequestURL, patchSignatureRequestURIParameters } from "../lib/sep-0007"
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
  querySignatureRequestByID,
  updateSignatureRequestURI,
  SignatureRequest
} from "../models/signature-request"
import { queryAllSignatureRequestSigners, setSignersHasSignedFlags } from "../models/signer"

async function submitToHorizon(horizon: Server, tx: Transaction) {
  try {
    return await horizon.submitTransaction(tx)
  } catch (error) {
    throw createError(
      400,
      "Transaction submission to horizon failed." +
        "\nResponse: " +
        JSON.stringify(error.response.data, null, 2) +
        "\nTx XDR: " +
        tx
          .toEnvelope()
          .toXDR()
          .toString("base64")
    )
  }
}

async function updateSignatureRequest(
  signatureRequest: SignatureRequest,
  collatedTx: Transaction,
  allSignerAccountIDs: string[]
) {
  const newSignaturesAccountIDs = allSignerAccountIDs.filter(accountID =>
    collatedTx.signatures.some(signature => signatureMatchesPublicKey(signature, accountID))
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
      setSignersHasSignedFlags(client, signatureRequest.id, newSignaturesAccountIDs)
    ])
  })
}

export async function collateSignatures(signatureRequestID: string, txXDR: string) {
  const inputTx = new Transaction(txXDR)
  const signatureRequest = await querySignatureRequestByID(database, signatureRequestID)

  if (!signatureRequest) {
    throw createError(404, `Signature request not found: ${signatureRequestID}`)
  }

  const signatureRequestParams = parseRequestURL(signatureRequest.request_uri).parameters
  const updatedSignaturesBase64 = inputTx.signatures.map(signature =>
    signature.toXDR().toString("base64")
  )

  await selectStellarNetwork(
    signatureRequestParams.network_passphrase || networkPassphrases.mainnet
  )

  const collatedTx = collateTransactionSignatures(inputTx, updatedSignaturesBase64)
  const horizon = getHorizon(
    signatureRequestParams.network_passphrase || networkPassphrases.mainnet
  )

  const [sourceAccount, allSigners] = await Promise.all([
    horizon.loadAccount(collatedTx.source),
    queryAllSignatureRequestSigners(database, signatureRequestID)
  ])

  await updateSignatureRequest(
    signatureRequest,
    collatedTx,
    allSigners.map(signer => signer.account_id)
  )
  const signers = await queryAllSignatureRequestSigners(database, signatureRequestID)

  await notifySignatureRequestUpdated({
    signatureRequest,
    signers
  })

  if (hasSufficientSignatures(sourceAccount, collatedTx.signatures)) {
    const submissionResponse = await submitToHorizon(horizon, collatedTx)
    await markSignatureRequestAsCompleted(database, signatureRequestID)

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
