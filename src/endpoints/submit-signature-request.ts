import createError from "http-errors"
import qs from "qs"
import { Transaction } from "stellar-sdk"
import uuid from "uuid"

import { horizon } from "../config"
import { database, transaction } from "../database"
import {
  getAllSigners,
  getAllSources,
  hasSufficientSignatures,
  signatureMatchesPublicKey
} from "../lib/stellar"
import { saveSigner } from "../models/signer"
import { createSignatureRequest, TxParameters } from "../models/signature-request"

function parseTransactionXDR(base64XDR: string) {
  try {
    return new Transaction(base64XDR)
  } catch (error) {
    throw createError(400, "Cannot parse transaction XDR: " + error.message)
  }
}

function validateParameters(parameters: any): TxParameters {
  if (!parameters.xdr) {
    throw createError(400, "Missing mandatory parameter in request URI: xdr")
  }

  return parameters
}

function parseRequestURL(requestURI: string) {
  if (!requestURI.startsWith("web+stellar:")) {
    throw createError(400, "Expected request to start with 'web+stellar:'")
  }

  const [operation, queryString] = requestURI.replace(/^web\+stellar:/, "").split("?", 2)
  const parameters = qs.parse(queryString)

  if (operation !== "tx") {
    throw createError(400, "This endpoint supports the 'tx' operation only.")
  }

  return {
    operation,
    parameters: validateParameters(parameters)
  }
}

export async function handleSignatureRequestSubmission(requestURI: string) {
  const { parameters } = parseRequestURL(requestURI)
  const tx = parseTransactionXDR(parameters.xdr)

  const sourceAccounts = await Promise.all(
    getAllSources(tx).map(sourcePublicKey => horizon.loadAccount(sourcePublicKey))
  )
  const requiredSigners = getAllSigners(sourceAccounts)

  if (tx.signatures.length === 0) {
    throw createError(
      400,
      "Can only submit signed transactions. You need to have signed the transaction with your key."
    )
  }
  if (
    !tx.signatures.every(signature =>
      requiredSigners.some(signer => signatureMatchesPublicKey(signature, signer))
    )
  ) {
    throw createError(
      400,
      "Transaction is signed by unrecognized public keys. Only sign with keys that are actually mandatory signers."
    )
  }
  if (sourceAccounts.every(account => hasSufficientSignatures(account, tx.signatures))) {
    throw createError(400, "Transaction is already sufficiently signed.")
  }

  const signatureRequest = await transaction(database, async client => {
    const signatureRequest = await createSignatureRequest(client, {
      id: uuid.v4(),
      designated_coordinator: true,
      request_url: requestURI,
      source_account_id: tx.source
    })

    await Promise.all(
      requiredSigners.map(async signerPublicKey => {
        const hasSigned = tx.signatures.some(signature =>
          signatureMatchesPublicKey(signature, signerPublicKey)
        )
        await saveSigner(client, {
          signature_request: signatureRequest.id,
          account_id: signerPublicKey,
          has_signed: hasSigned
        })
      })
    )

    return signatureRequest
  })

  // TODO: NOTIFY

  return {
    id: signatureRequest.id
  }
}
