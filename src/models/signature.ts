import { spreadInsert, sql } from "squid/pg"
import { DBClient } from "../database"

export interface Signature {
  signature_request: string
  signer_account_id: string
  signature: string
  created_at: Date
}

export type NewSignature = Omit<Signature, "created_at">

export async function saveSignature(client: DBClient, signature: NewSignature): Promise<Signature> {
  const { rows } = await client.query(sql`
    INSERT INTO signatures
      ${spreadInsert(signature)}
    RETURNING *
  `)

  return rows[0]
}

export async function querySignatureRequestSignatures(
  client: DBClient,
  id: string
): Promise<Signature[]> {
  const { rows } = await client.query(sql`
    SELECT * FROM signatures
      WHERE signature_request = ${id}
  `)
  return rows
}
