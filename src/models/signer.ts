import { DBClient } from "../database"

export interface Signer {
  signature_request: string
  account_id: string
  has_signed: boolean
}

export type SerializedSigner = ReturnType<typeof serializeSigner>

export function serializeSigner(signer: Signer) {
  return {
    account_id: signer.account_id,
    has_signed: signer.has_signed
  }
}

export async function saveSigner(client: DBClient, signer: Signer) {
  await client.query(
    `
    INSERT INTO signers
    (signature_request, account_id, has_signed)
    SELECT $1::uuid, $2::text, $3::boolean
    WHERE NOT EXISTS (
      SELECT signature_request FROM signers
      WHERE signature_request = $1 AND account_id = $2
    )
  `,
    [signer.signature_request, signer.account_id, signer.has_signed]
  )
  return signer
}

export async function setSignersHasSignedFlags(
  client: DBClient,
  signatureRequestID: string,
  accountIDs: string[]
) {
  const { rowCount } = await client.query(
    "UPDATE signers SET has_signed = true WHERE signature_request = $1 AND account_id = ANY($2)",
    [signatureRequestID, accountIDs]
  )

  if (rowCount < accountIDs.length) {
    throw new Error(
      `Could not set signer has_signed flag for all signers. Signature request: ${signatureRequestID}, Account IDs: ${accountIDs.join(
        ", "
      )}`
    )
  }
}

export async function queryAllSignatureRequestSigners(
  client: DBClient,
  signatureRequestID: string
) {
  const { rows } = await client.query("SELECT * FROM signers WHERE signature_request = $1", [
    signatureRequestID
  ])
  return rows as Signer[]
}
