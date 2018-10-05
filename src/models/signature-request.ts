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
  created_at: string
  updated_at: string
  completed_at: Date | null
  designated_coordinator: boolean
  request_uri: string
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

interface QueryOptions {
  cursor?: number
  limit?: number
}

export async function createSignatureRequest(
  client: DBClient,
  signatureRequest: NewSignatureRequest
) {
  const { rows } = await client.query(
    `
    INSERT INTO
      signature_requests
    (id, designated_coordinator, request_uri, source_account_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
    [
      signatureRequest.id,
      signatureRequest.designated_coordinator,
      signatureRequest.request_uri,
      signatureRequest.source_account_id
    ]
  )
  return rows[0] as SignatureRequest
}

export async function updateSignatureRequestURI(
  client: DBClient,
  id: string,
  signatureRequestURI: string
) {
  const { rowCount } = await client.query(
    `
    UPDATE signature_requests
    SET request_uri = $2, updated_at = NOW()
    WHERE id = $1
  `,
    [id, signatureRequestURI]
  )

  if (rowCount !== 1) {
    throw new Error(`Signature request could not be updated, probably not found: ${id}`)
  }
}

export async function markSignatureRequestAsCompleted(client: DBClient, id: string) {
  const { rowCount } = await client.query(
    `
    UPDATE signature_requests
    SET completed_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `,
    [id]
  )

  if (rowCount !== 1) {
    throw new Error(`Signature request could not be marked as completed, probably not found: ${id}`)
  }
}

export async function querySignatureRequestByID(client: DBClient, id: string) {
  const { rows } = await client.query(
    `
    SELECT * FROM signature_requests WHERE id = $1
  `,
    [id]
  )
  return rows.length > 0 ? (rows[0] as SignatureRequest) : null
}

export async function querySignatureRequestsBySource(
  client: DBClient,
  sourceAccountID: string,
  queryOptions: QueryOptions = {}
) {
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
        AND created_at > $2
        AND completed_at IS NULL
      ORDER BY created_at ASC
      LIMIT $3
    `,
    [sourceAccountID, new Date(queryOptions.cursor || 0), queryOptions.limit || 100]
  )
  return rows as SignatureRequestWithCosignerCounts[]
}

export async function querySignatureRequestsByCosigner(
  client: DBClient,
  cosignerAccountID: string,
  queryOptions: QueryOptions = {}
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
        AND created_at > $2
        AND completed_at IS NULL
      ORDER BY signature_requests.created_at ASC
      LIMIT $3
    `,
    [cosignerAccountID, new Date(queryOptions.cursor || 0), queryOptions.limit || 100]
  )
  return rows as SignatureRequestWithCosignerCounts[]
}
