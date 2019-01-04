import { database } from "../database"
import {
  querySignatureRequestsBySigner,
  serializeSignatureRequest
} from "../models/signature-request"
import { serializeSigner, queryAllSignatureRequestSigners } from "../models/signer"

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
    signatureRequests.map(async signatureRequest => {
      const signers = await queryAllSignatureRequestSigners(database, signatureRequest.id)
      return serializeSignatureRequest(signatureRequest, signers.map(serializeSigner))
    })
  )

  return signatureRequestsSerialized
}
