import { database } from "../database"
import {
  querySignatureRequestsBySigner,
  serializeSignatureRequest,
  SignatureRequest
} from "../models/signature-request"
import { querySignatureRequestSignatures, Signature } from "../models/signature"
import { queryAllSignatureRequestSigners, Signer } from "../models/signer"

export function serializeSigner(signer: Signer, signatures: Signature[]) {
  return {
    account_id: signer.account_id,
    has_signed: signatures.some(signature => signature.signer_account_id === signer.account_id)
  }
}

export async function serializeSignatureRequestAndSigners(signatureRequest: SignatureRequest) {
  const [signers, signatures] = await Promise.all([
    queryAllSignatureRequestSigners(database, signatureRequest.id),
    querySignatureRequestSignatures(database, signatureRequest.id)
  ])
  const keysWhoSignedAlready = signatures.map(signature => signature.signer_account_id)
  const serializedSigners = await Promise.all(
    signers.map(signer => serializeSigner(signer, signatures))
  )
  return serializeSignatureRequest(
    signatureRequest,
    serializedSigners.filter(signer => keysWhoSignedAlready.includes(signer.account_id))
  )
}

interface QueryOptions {
  cursor?: string
  limit?: number
}

export async function querySignatureRequests(
  accountIDs: string[],
  queryOptions: QueryOptions = {}
) {
  const signatureRequests = await querySignatureRequestsBySigner(database, accountIDs, queryOptions)

  const signatureRequestsSerialized = await Promise.all(
    signatureRequests.map(serializeSignatureRequestAndSigners)
  )

  return signatureRequestsSerialized
}
