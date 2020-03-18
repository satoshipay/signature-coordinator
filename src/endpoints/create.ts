import { parseStellarUri, TransactionStellarUri } from "@stellarguard/stellar-uri"
import { createHash } from "crypto"
import createError from "http-errors"
import ms from "ms"
import { Keypair, Networks, Transaction } from "stellar-sdk"
import UUID from "uuid"

import config from "../config"
import { transaction } from "../database"
import { notifyNewSignatureRequest } from "../notifications"
import { getAllSigners, getAllSources, getHorizon, hasSufficientSignatures } from "../lib/stellar"
import { saveSigner, Signer } from "../models/signer"
import { saveSignature } from "../models/signature"
import { createSignatureRequest } from "../models/signature-request"
import { saveSourceAccount } from "../models/source-account"
import { serializeSignatureRequestAndSigners } from "./query"

const dedupe = <T>(array: T[]): T[] => Array.from(new Set(array))

function parseTransactionXDR(base64XDR: string, network: Networks) {
  try {
    return new Transaction(base64XDR, network)
  } catch (error) {
    throw createError(400, "Cannot parse transaction XDR: " + error.message)
  }
}

function hashSignatureRequest(requestURI: string) {
  const hash = createHash("sha256")
  hash.update(requestURI, "utf8")
  return hash.digest("hex")
}

export async function handleSignatureRequestSubmission(
  requestURI: string,
  signatureXDR: string,
  signaturePubKey: string
) {
  const uri = parseStellarUri(requestURI) as TransactionStellarUri

  if (uri.operation !== "tx") {
    throw createError(400, "This endpoint supports the 'tx' operation only.")
  }

  const keypair = Keypair.fromPublicKey(signaturePubKey)
  const network = (uri.networkPassphrase || Networks.PUBLIC) as Networks
  const tx = parseTransactionXDR(uri.xdr, network)

  const sourceAccounts = await Promise.all(
    getAllSources(tx).map(sourcePublicKey => getHorizon(network).loadAccount(sourcePublicKey))
  )
  const requiredSigners = getAllSigners(sourceAccounts)

  if (tx.signatures.length > 0) {
    throw createError(400, "You need to submit an unsigned transaction.")
  }

  if (!keypair.verify(tx.hash(), Buffer.from(signatureXDR, "base64"))) {
    throw createError(400, "Provided invalid signature.")
  }

  if (!requiredSigners.includes(signaturePubKey)) {
    throw createError(
      400,
      "Transaction signature is created by an unrecognized key. Only sign with keys that are signers."
    )
  }

  if (sourceAccounts.every(account => hasSufficientSignatures(account, tx.signatures))) {
    throw createError(400, "Transaction is already sufficiently signed.")
  }

  if (!tx.timeBounds || !tx.timeBounds.maxTime) {
    throw createError(400, `Transaction must have upper timebound set.`)
  } else if (Number.parseInt(tx.timeBounds.maxTime, 10) * 1000 > Date.now() + ms(config.txMaxTtl)) {
    throw createError(
      400,
      `Transaction times out too late. Only accepting transactions valid for max. ${config.txMaxTtl}.`
    )
  }

  const { serialized, signers } = await transaction(async client => {
    const signatureRequest = await createSignatureRequest(client, {
      id: UUID.v4(),
      hash: hashSignatureRequest(requestURI),
      req: requestURI,
      status: "pending",
      expires_at: new Date(Number.parseInt(tx.timeBounds!.maxTime, 10) * 1000)
    })

    await Promise.all(
      sourceAccounts.map(sourceAccount => {
        return saveSourceAccount(client, {
          signature_request: signatureRequest.id,
          account_id: sourceAccount.id,
          key_weight_threshold: sourceAccount.thresholds.high_threshold
        })
      })
    )

    const createdSigners: Signer[] = []

    for (const source of sourceAccounts) {
      for (const signer of source.signers) {
        const record = await saveSigner(client, {
          signature_request: signatureRequest.id,
          source_account_id: source.account_id,
          account_id: signer.key,
          key_weight: signer.weight
        })
        createdSigners.push(record)
      }
    }

    await saveSignature(client, {
      signature_request: signatureRequest.id,
      signer_account_id: signaturePubKey,
      signature: signatureXDR
    })

    return {
      serialized: await serializeSignatureRequestAndSigners(signatureRequest),
      signers: createdSigners
    }
  })

  const signerKeys = dedupe(signers.map(signer => signer.account_id))
  await notifyNewSignatureRequest(serialized, signerKeys)

  return serialized
}
