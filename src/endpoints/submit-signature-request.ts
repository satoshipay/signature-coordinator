import createError from "http-errors"
import { Transaction } from "stellar-sdk"
import uuid from "uuid"

import { transaction } from "../database"
import { notifyNewSignatureRequest } from "../notifications"
import { parseRequestURL } from "../lib/sep-0007"
import {
  getAllSigners,
  getAllSources,
  getHorizon,
  hasSufficientSignatures,
  networkPassphrases,
  signatureMatchesPublicKey
} from "../lib/stellar"
import { saveSigner, Signer } from "../models/signer"
import { createSignatureRequest } from "../models/signature-request"

function parseTransactionXDR(base64XDR: string) {
  try {
    return new Transaction(base64XDR)
  } catch (error) {
    throw createError(400, "Cannot parse transaction XDR: " + error.message)
  }
}

export async function handleSignatureRequestSubmission(requestURI: string) {
  const { parameters } = parseRequestURL(requestURI)
  const network = parameters.network_passphrase || networkPassphrases.mainnet
  const tx = parseTransactionXDR(parameters.xdr)

  const sourceAccounts = await Promise.all(
    getAllSources(tx).map(sourcePublicKey => getHorizon(network).loadAccount(sourcePublicKey))
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

  const { signatureRequest, signers } = await transaction(async client => {
    const sigRequest = await createSignatureRequest(client, {
      id: uuid.v4(),
      designated_coordinator: true,
      request_uri: requestURI,
      source_account_id: tx.source
    })

    const signersToCreate: Signer[] = requiredSigners.map(signerPublicKey => {
      const hasSigned = tx.signatures.some(signature =>
        signatureMatchesPublicKey(signature, signerPublicKey)
      )
      return {
        signature_request: sigRequest.id,
        account_id: signerPublicKey,
        has_signed: hasSigned
      }
    })

    await Promise.all(
      signersToCreate.map(async signer => {
        await saveSigner(client, signer)
      })
    )

    return {
      signatureRequest: sigRequest,
      signers: signersToCreate
    }
  })

  await notifyNewSignatureRequest({
    signatureRequest,
    signers
  })

  return {
    id: signatureRequest.id
  }
}
