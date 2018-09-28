import { DBClient } from "../database"

interface Cosigner {
  signature_request: string
  cosigner_account_id: string
  has_signed: boolean
}

export async function saveCosigner(client: DBClient, cosigner: Cosigner) {
  const { rows } = await client.query(
    `
    INSERT INTO cosigners
    (signature_request, cosigner_account_id, has_signed)
    VALUES ($1, $2, $3)
    RETURNING *
  `,
    [cosigner.signature_request, cosigner.cosigner_account_id, cosigner.has_signed]
  )
  return rows[0]
}
