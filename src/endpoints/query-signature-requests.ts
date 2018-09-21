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
    accountRole,
    createdAt: signatureRequest.created_at,
    updatedAt: signatureRequest.updated_at,
    requestURL: signatureRequest.request_url,
    cosignerCount: signatureRequest.cosigner_count,
    cosignatureCount: signatureRequest.cosignature_count
  }
}

export async function querySignatureRequests(accountID: string) {
  const [originatingRequests, cosignatureRequests] = await Promise.all([
    querySignatureRequestsBySource(database, accountID),
    querySignatureRequestsByCosigner(database, accountID)
  ])

  return [
    ...originatingRequests.map(request => respondSignatureRequest(request, "source")),
    ...cosignatureRequests.map(request => respondSignatureRequest(request, "cosigner"))
  ]
}
