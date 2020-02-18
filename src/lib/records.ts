import { database } from "../database"
import { queryAllSourceAccountSigners } from "../models/signer"
import { Signature } from "../models/signature"
import { SignatureRequest } from "../models/signature-request"
import { SourceAccount } from "../models/source-account"

export async function hasSufficientSignatures(
  signatureRequest: SignatureRequest,
  sourceAccounts: SourceAccount[],
  signatures: Signature[]
) {
  const results = await Promise.all(
    sourceAccounts.map(async sourceAccount => {
      const signers = await queryAllSourceAccountSigners(
        database,
        signatureRequest.id,
        sourceAccount.account_id
      )
      const weight = signatures.reduce((accumulated, signature) => {
        const signer = signers.find(s => s.account_id === signature.signer_account_id)

        if (!signer) {
          throw Error(`Invariant violation: No signer record for ${signature.signer_account_id}`)
        }
        return accumulated + signer.key_weight
      }, 0)
      return weight >= sourceAccount.key_weight_threshold
    })
  )
  return results.every(result => result === true)
}
