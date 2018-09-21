import { DBClient } from "../database"

export interface SignatureRequestParams {
  xdr: string
  callback?: string
  pubkey?: string
  msg?: string
  network_passphrase?: string
  origin_domain?: string
  signature?: string
}

export interface SignatureRequest {
  id: string
  created_at: Date
  updated_at: Date
  completed_at: Date | null
  designated_coordinator: boolean
  params: SignatureRequestParams
  request_url: string
  source_account_id: string
}

export type SignatureRequestWithCosignerCounts = SignatureRequest & {
  cosigner_count: number
  cosignature_count: number
}

export async function querySignatureRequestsBySource(client: DBClient, sourceAccountID: string) {
  const { rows } = await client.query(
    `
      SELECT
        *,
        (
          SELECT count(cosigner_account_id)
          FROM signature_request_cosigners
          WHERE signature_request = signature_requests.id
        ) AS cosigner_count,
        (
          SELECT count(cosigner_account_id)
          FROM signature_request_cosigners
          WHERE signature_request = signature_requests.id
          AND has_signed = true
        ) AS cosignature_count
      FROM
        signature_requests
      WHERE
        source_account_id = $1
        AND completed_at = NULL
    `,
    [sourceAccountID]
  )
  return rows as SignatureRequestWithCosignerCounts[]
}

export async function querySignatureRequestsByCosigner(
  client: DBClient,
  cosignerAccountID: string
) {
  const { rows } = await client.query(
    `
      SELECT
        signature_requests.*,
        (
          SELECT count(cosigner_account_id)
          FROM signature_request_cosigners
          WHERE signature_request = signature_requests.id
        ) AS cosigner_count,
        (
          SELECT count(cosigner_account_id)
          FROM signature_request_cosigners
          WHERE signature_request = signature_requests.id
          AND has_signed = true
        ) AS cosignature_count
      FROM
        signature_requests
      LEFT JOIN signature_request_cosigners
        ON signature_requests.id = signature_request_cosigners.signature_request
      WHERE
        signature_request_cosigners.cosigner_account_id = $1
        AND completed_at = NULL
    `,
    [cosignerAccountID]
  )
  return rows as SignatureRequestWithCosignerCounts[]
}
