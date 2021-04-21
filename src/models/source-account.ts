import { spreadInsert, sql } from "squid/pg"
import { DBClient } from "../database"

export interface SourceAccount {
  signature_request: string
  account_id: string
  key_weight_threshold: number
}

export async function saveSourceAccount(
  client: DBClient,
  source: SourceAccount
): Promise<SourceAccount> {
  const { rows } = await client.query(sql`
    INSERT INTO source_accounts ${spreadInsert(source)}
      RETURNING *
  `)
  return rows[0]
}

export async function queryAllSignatureRequestSourceAccounts(
  client: DBClient,
  signatureRequestID: string
): Promise<SourceAccount[]> {
  const { rows } = await client.query(sql`
    SELECT * FROM source_accounts WHERE signature_request = ${signatureRequestID}
  `)
  return rows
}
