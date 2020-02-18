import { parseStellarUri, TransactionStellarUri } from "@stellarguard/stellar-uri"
import HttpError from "http-errors"
import { Keypair, Networks, Transaction } from "stellar-sdk"

import { database } from "../database"
import { hasSufficientSignatures } from "../lib/records"
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

export async function collateSignatures(
  signatureRequestHash: string,
  signatureXDR: string,
  signerPubKey: string
) {
  const signatureRequest = await querySignatureRequestByHash(database, signatureRequestHash)

  if (!signatureRequest) {
    throw HttpError(404, `Signature request not found: ${signatureRequestHash}`)
  }

  const signers = await queryAllSignatureRequestSigners(database, signatureRequest.id)
  const signerAccountIDs = dedupe(signers.map(signer => signer.account_id))

  if (!signerAccountIDs.includes(signerPubKey)) {
    throw HttpError(400, `Will not collate signature of unexpected signer.`)
  }

  const signerKey = Keypair.fromPublicKey(signerPubKey)
  const uri = parseStellarUri(signatureRequest.req) as TransactionStellarUri

  const network = (uri.networkPassphrase || Networks.PUBLIC) as Networks
  const tx = new Transaction(uri.xdr, network)

  if (!signerKey.verify(tx.hash(), Buffer.from(signatureXDR, "base64"))) {
    throw HttpError(400, "Invalid signature")
  }

  await saveSignature(database, {
    signature_request: signatureRequest.id,
    signer_account_id: signerPubKey,
    signature: signatureXDR
  })

  const allSignatures = await querySignatureRequestSignatures(database, signatureRequest.id)
  const sourceAccounts = await queryAllSignatureRequestSourceAccounts(database, signatureRequest.id)

  if (hasSufficientSignatures(signatureRequest, sourceAccounts, allSignatures)) {
    // const submissionResponse = await submitToHorizon(horizon, collatedTx)
    // await updateSignatureRequestStatus(database, signatureRequest.id, "submitted")

    // await notifySignatureRequestSubmitted({
    //   signatureRequest,
    //   signers
    // })

    await updateSignatureRequestStatus(database, signatureRequest.id, "ready")
  }

  const serialized = await serializeSignatureRequestAndSigners(signatureRequest)
  await notifySignatureRequestUpdate(serialized, signerAccountIDs)
}
