import { spreadInsert, sql } from "squid/pg"
import { DBClient } from "../database"

export interface SignatureRequestError {
  message: string
  details?: any
}

export interface SignatureRequest {
  id: string
  error?: SignatureRequestError
  hash: string
  req: string
  status: "pending" | "ready" | "submitted" | "failed"
  created_at: Date
  updated_at: Date
  expires_at: Date
}

export type NewSignatureRequest = Omit<SignatureRequest, "created_at" | "updated_at"> &
  Partial<Pick<SignatureRequest, "created_at" | "updated_at">>

export type SerializedSignatureRequest = ReturnType<typeof serializeSignatureRequest>

interface QueryOptions {
  cursor?: string
  limit?: number
}

interface SerializedSigner {
  account_id: string
  has_signed: boolean
}

export function serializeSignatureRequest(
  signatureRequest: SignatureRequest,
  signers: SerializedSigner[]
) {
  const isStale = signatureRequest.expires_at && signatureRequest.expires_at.getTime() < Date.now()

  return {
    created_at: signatureRequest.created_at,
    cursor: signatureRequest.hash,
    error: isStale ? { message: "Transaction is stale" } : signatureRequest.error,
    hash: signatureRequest.hash,
    req: signatureRequest.req,
    status: isStale ? "failed" : signatureRequest.status,
    signed_by: signers.map(signer => signer.account_id).sort(), // the .sort() is only to make tests deterministic
    updated_at: signatureRequest.updated_at
  }
}

export async function createSignatureRequest(
  client: DBClient,
  signatureRequest: NewSignatureRequest
) {
  if (!signatureRequest.expires_at) {
    // Reasoning: We want to be able to remove those txs safely from the database later
    throw Error(
      `Transaction must have an upper timebound set. Signature request hash: ${signatureRequest.hash}`
    )
  }

  const { rows } = await client.query(sql`
    INSERT INTO signature_requests
      ${spreadInsert({
        ...signatureRequest,
        hash: signatureRequest.hash.toLowerCase(),
        created_at: signatureRequest.created_at
          ? signatureRequest.created_at.toISOString()
          : undefined,
        updated_at: signatureRequest.updated_at
          ? signatureRequest.updated_at.toISOString()
          : undefined,
        expires_at: signatureRequest.expires_at
          ? signatureRequest.expires_at.toISOString()
          : undefined
      })}
      RETURNING *
  `)

  return rows[0] as SignatureRequest
}

export async function failSignatureRequest(
  client: DBClient,
  id: string,
  error: SignatureRequestError
) {
  await client.query(sql`
    UPDATE signature_requests
      SET error = ${error}, status = 'failed', updated_at = NOW()
      WHERE id = ${id}
  `)
}

export async function updateSignatureRequestStatus(
  client: DBClient,
  id: string,
  status: "ready" | "submitted"
) {
  const { rowCount } = await client.query(sql`
    UPDATE signature_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
  `)

  if (rowCount !== 1) {
    throw new Error(`Signature request could not be marked as completed, probably not found: ${id}`)
  }
}

export async function querySignatureRequestByHash(
  client: DBClient,
  hash: string
): Promise<SignatureRequest | null> {
  const { rows } = await client.query(sql`
    SELECT * FROM signature_requests WHERE hash = ${hash.toLowerCase()}
  `)
  return rows.length > 0 ? rows[0] : null
}

export async function querySignatureRequestsBySigner(
  client: DBClient,
  accountIDs: string[],
  queryOptions: QueryOptions = {}
) {
  const requestAtCursor = queryOptions.cursor
    ? await querySignatureRequestByHash(client, queryOptions.cursor)
    : null

  if (queryOptions.cursor && !requestAtCursor) {
    console.log(">", queryOptions.cursor)
    console.log(">", (await client.query(sql`SELECT hash FROM signature_requests`)).rows)
    throw Error(`Cannot find a signature request matching the cursor hash.`)
  }

  const { rows } = await client.query(sql`
    WITH signature_request_ids AS (
      SELECT DISTINCT signature_request AS id
        FROM signers
        WHERE account_id = ANY(${accountIDs})
    )
    SELECT DISTINCT *
      FROM signature_requests
      WHERE id IN (SELECT id FROM signature_request_ids)
        AND created_at > ${
          requestAtCursor ? requestAtCursor.created_at.toISOString() : "1970-01-01T00:00:00Z"
        }
      ORDER BY signature_requests.created_at ASC
      LIMIT ${queryOptions.limit || 100}
  `)
  return rows as SignatureRequest[]
}
