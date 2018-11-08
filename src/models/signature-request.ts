import { DBClient } from "../database"
import { SerializedSigner } from "./signer"

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

export interface SignatureRequest {
  id: string
  hash: string
  created_at: string
  updated_at: string
  completed_at: string | null
  designated_coordinator: boolean
  request_uri: string
  source_account_id: string
}

export type NewSignatureRequest = Omit<
  SignatureRequest,
  "created_at" | "updated_at" | "completed_at"
>

interface QueryOptions {
  cursor?: number
  limit?: number
}

export function serializeSignatureRequest(
  signatureRequest: SignatureRequest,
  signers: SerializedSigner[]
) {
  return {
    hash: signatureRequest.hash,
    request_uri: signatureRequest.request_uri,
    created_at: signatureRequest.created_at,
    updated_at: signatureRequest.updated_at,
    completed_at: signatureRequest.completed_at,
    _embedded: {
      signers
    }
  }
}

export async function createSignatureRequest(
  client: DBClient,
  signatureRequest: NewSignatureRequest
) {
  await client.query(
    `
    INSERT INTO signature_requests
      (id, hash, designated_coordinator, request_uri, source_account_id)
    SELECT $1::uuid, $2::text, $3, $4, $5
    WHERE NOT EXISTS (
      SELECT id FROM signature_requests WHERE hash = $2
    )
  `,
    [
      signatureRequest.id,
      signatureRequest.hash.toLowerCase(),
      signatureRequest.designated_coordinator,
      signatureRequest.request_uri,
      signatureRequest.source_account_id
    ]
  )

  const { rows } = await client.query("SELECT * FROM signature_requests WHERE hash = $1", [
    signatureRequest.hash
  ])

  if (rows.length === 0) {
    throw new Error(
      `Invariant violation: Could not query just-created signature request with hash ${signatureRequest.hash.toLowerCase()}`
    )
  }

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

export async function querySignatureRequestByHash(client: DBClient, hash: string) {
  const { rows } = await client.query(
    `
    SELECT * FROM signature_requests WHERE hash = $1
  `,
    [hash.toLowerCase()]
  )
  return rows.length > 0 ? (rows[0] as SignatureRequest) : null
}

export async function querySignatureRequestsBySigner(
  client: DBClient,
  accountIDs: string[],
  queryOptions: QueryOptions = {}
) {
  const { rows } = await client.query(
    `
    SELECT
      DISTINCT signature_requests.*
    FROM
      signature_requests LEFT JOIN signers
      ON (signature_requests.id = signers.signature_request)
    WHERE
      (
        signers.account_id = ANY($1) OR
        signature_requests.source_account_id = ANY($1)
      )
      AND created_at > $2
      AND completed_at IS NULL
    ORDER BY signature_requests.created_at ASC
    LIMIT $3
  `,
    [accountIDs, new Date(queryOptions.cursor || 0), queryOptions.limit || 100]
  )
  return rows as SignatureRequest[]
}
