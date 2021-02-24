import { parseStellarUri, TransactionStellarUri } from "@stellarguard/stellar-uri"
import HttpError from "http-errors"
import { Networks, Transaction, Utils } from "stellar-sdk"

import { database } from "../database"
import { hasSufficientSignatures } from "../lib/records"
import { signatureMatchesPublicKey } from "../lib/stellar"
import {
  querySignatureRequestByHash,
  updateSignatureRequestStatus
} from "../models/signature-request"
import { querySignatureRequestSignatures, saveSignature } from "../models/signature"
import { queryAllSignatureRequestSigners } from "../models/signer"
import { queryAllSignatureRequestSourceAccounts } from "../models/source-account"
import { notifySignatureRequestUpdate } from "../notifications"
import { serializeSignatureRequestAndSigners } from "./query"

const dedupe = <T>(array: T[]): T[] => Array.from(new Set(array))

export async function collateSignatures(signatureRequestHash: string, signedTxXDR: string) {
  const signatureRequest = await querySignatureRequestByHash(database, signatureRequestHash)

  if (!signatureRequest) {
    throw HttpError(404, `Transaction not found: ${signatureRequestHash}`)
  }
  if (signatureRequest.status === "ready") {
    throw HttpError(400, `Transaction is already sufficiently signed.`)
  }
  if (signatureRequest.status === "submitted" || signatureRequest.status === "failed") {
    throw HttpError(400, `Transaction has already been submitted.`)
  }

  const signers = await queryAllSignatureRequestSigners(database, signatureRequest.id)
  const signerAccountIDs = dedupe(signers.map(signer => signer.account_id))
  const uri = parseStellarUri(signatureRequest.req) as TransactionStellarUri

  const network = (uri.networkPassphrase || Networks.PUBLIC) as Networks

  let tx = null
  try {
    tx = new Transaction(signedTxXDR, network)
  } catch (error) {
    throw HttpError(400, "Transaction could not be parsed.")
  }

  if (tx.signatures.length !== 1) {
    throw HttpError(
      400,
      `Expected exactly one signature on the transaction. Got ${tx.signatures.length}.`
    )
  }

  const signature = tx.signatures[0]
  const signerPubKey = signerAccountIDs.find(pubKey => signatureMatchesPublicKey(signature, pubKey))

  if (!signerPubKey || !Utils.verifyTxSignedBy(tx, signerPubKey)) {
    throw HttpError(
      400,
      `The signature on the transaction does not seem to belong to a valid signer.`
    )
  }

  const signatures = await querySignatureRequestSignatures(database, signatureRequest.id)

  if (signatures.some(sig => sig.signer_account_id === signerPubKey)) {
    throw HttpError(400, "Signature has already been submitted")
  }

  await saveSignature(database, {
    signature_request: signatureRequest.id,
    signer_account_id: signerPubKey,
    signature: signature.signature().toString("base64")
  })

  const allSignatures = await querySignatureRequestSignatures(database, signatureRequest.id)
  const sourceAccounts = await queryAllSignatureRequestSourceAccounts(database, signatureRequest.id)

  if (hasSufficientSignatures(signatureRequest, sourceAccounts, allSignatures)) {
    await updateSignatureRequestStatus(database, signatureRequest.id, "ready")

    // Mutate our local object, too, or the data in the response will be stale
    signatureRequest.status = "ready"
  }

  const serialized = await serializeSignatureRequestAndSigners(signatureRequest)
  await notifySignatureRequestUpdate(serialized, signerAccountIDs)

  return serialized
}
