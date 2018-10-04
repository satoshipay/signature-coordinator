import { DBClient } from "../database"

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

export interface TxParameters {
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
  request_url: string
  source_account_id: string
}

export type NewSignatureRequest = Omit<
  SignatureRequest,
  "created_at" | "updated_at" | "completed_at"
>

export type SignatureRequestWithCosignerCounts = SignatureRequest & {
  signer_count: number
  signature_count: number
}

export async function createSignatureRequest(
  client: DBClient,
  signatureRequest: NewSignatureRequest
) {
  const { rows } = await client.query(
    `
    INSERT INTO
      signature_requests
    (id, designated_coordinator, request_url, source_account_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
    [
      signatureRequest.id,
      signatureRequest.designated_coordinator,
      signatureRequest.request_url,
      signatureRequest.source_account_id
    ]
  )
  return rows[0] as SignatureRequest
}

export async function querySignatureRequestsBySource(client: DBClient, sourceAccountID: string) {
  const { rows } = await client.query(
    `
      SELECT
        *,
        (
          SELECT count(account_id)::INT
          FROM signers
          WHERE signature_request = signature_requests.id
        ) AS signer_count,
        (
          SELECT count(account_id)::INT
          FROM signers
          WHERE signature_request = signature_requests.id
          AND has_signed = true
        ) AS signature_count
      FROM
        signature_requests
      WHERE
        source_account_id = $1
        AND completed_at IS NULL
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
          SELECT count(account_id)::INT
          FROM signers
          WHERE signature_request = signature_requests.id
        ) AS signer_count,
        (
          SELECT count(account_id)::INT
          FROM signers
          WHERE signature_request = signature_requests.id
          AND has_signed = true
        ) AS signature_count
      FROM
        signature_requests
      LEFT JOIN signers
        ON signature_requests.id = signers.signature_request
      WHERE
        signers.account_id = $1
        AND signature_requests.source_account_id != $1
        AND completed_at IS NULL
    `,
    [cosignerAccountID]
  )
  return rows as SignatureRequestWithCosignerCounts[]
}
