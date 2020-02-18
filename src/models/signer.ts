import { spreadInsert, sql } from "squid/pg"
import { DBClient } from "../database"

export interface Signer {
  signature_request: string
  source_account_id: string
  account_id: string
  key_weight: number
}

export async function saveSigner(client: DBClient, signer: Signer): Promise<Signer> {
  const { rows } = await client.query(sql`
    INSERT INTO signers ${spreadInsert(signer)}
      RETURNING *
  `)
  return rows[0]
}

export async function queryAllSignatureRequestSigners(
  client: DBClient,
  signatureRequestID: string
): Promise<Signer[]> {
  const { rows } = await client.query(sql`
    SELECT * FROM signers WHERE signature_request = ${signatureRequestID}
  `)
  return rows
}

export async function queryAllSourceAccountSigners(
  client: DBClient,
  signatureRequestID: string,
  sourceAccountID: string
): Promise<Signer[]> {
  const { rows } = await client.query(sql`
    SELECT * FROM signers
      WHERE signature_request = ${signatureRequestID}
        AND source_account_id = ${sourceAccountID}
  `)
  return rows
}
