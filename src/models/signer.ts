import { DBClient } from "../database"

interface Signer {
  signature_request: string
  account_id: string
  has_signed: boolean
}

export async function saveSigner(client: DBClient, signer: Signer) {
  const { rows } = await client.query(
    `
    INSERT INTO signers
    (signature_request, account_id, has_signed)
    VALUES ($1, $2, $3)
    RETURNING *
  `,
    [signer.signature_request, signer.account_id, signer.has_signed]
  )
  return rows[0]
}
