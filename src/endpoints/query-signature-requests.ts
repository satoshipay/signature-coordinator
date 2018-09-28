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
    created_at: signatureRequest.created_at,
    updated_at: signatureRequest.updated_at,
    request_url: signatureRequest.request_url,
    cosigner_count: signatureRequest.cosigner_count,
    cosignature_count: signatureRequest.cosignature_count
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
