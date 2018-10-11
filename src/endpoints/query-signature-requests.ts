import { database } from "../database"
import {
  querySignatureRequestsBySigner,
  serializeSignatureRequest
} from "../models/signature-request"
import { serializeSigner, queryAllSignatureRequestSigners } from "../models/signer"

interface QueryOptions {
  cursor?: number
  limit?: number
}

export async function querySignatureRequests(
  accountIDs: string[],
  queryOptions: QueryOptions = {}
) {
  const signatureRequests = await querySignatureRequestsBySigner(database, accountIDs, queryOptions)

  const signatureRequestsSerialized = await Promise.all(
    signatureRequests.map(async signatureRequest => ({
      signatureRequest: serializeSignatureRequest(signatureRequest),
      signers: (await queryAllSignatureRequestSigners(database, signatureRequest.id)).map(signer =>
        serializeSigner(signer)
      )
    }))
  )

  return signatureRequestsSerialized
}
