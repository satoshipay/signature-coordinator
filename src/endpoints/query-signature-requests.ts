import { database } from "../database"
import {
  querySignatureRequestsBySource,
  querySignatureRequestsByCosigner,
  SignatureRequestWithCosignerCounts
} from "../models/signature-request"

function respondSignatureRequest(
  signatureRequest: SignatureRequestWithCosignerCounts,
  accountRole: string
) {
  return {
    account_role: accountRole,
    id: signatureRequest.id,
    created_at: signatureRequest.created_at,
    updated_at: signatureRequest.updated_at,
    request_uri: signatureRequest.request_uri,
    signer_count: signatureRequest.signer_count,
    signature_count: signatureRequest.signature_count
  }
}

interface QueryOptions {
  offset?: number
  limit?: number
}

export async function querySignatureRequests(accountID: string, queryOptions: QueryOptions = {}) {
  const [originatingRequests, cosignatureRequests] = await Promise.all([
    querySignatureRequestsBySource(database, accountID, queryOptions),
    querySignatureRequestsByCosigner(database, accountID, queryOptions)
  ])

  return [
    ...originatingRequests.map(request => respondSignatureRequest(request, "source")),
    ...cosignatureRequests.map(request => respondSignatureRequest(request, "cosigner"))
  ]
}
