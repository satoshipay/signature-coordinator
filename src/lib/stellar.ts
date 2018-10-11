import { AccountResponse, Keypair, Network, Server, Transaction, xdr } from "stellar-sdk"

import { horizonServers } from "../config"

interface SignatureWithHint extends xdr.DecoratedSignature {
  hint(): Buffer
}

export const networkPassphrases = {
  mainnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015"
}

const dedupe = <T>(array: T[]) => [...new Set(array)]
const sum = (array: number[]) => array.reduce((total, element) => total + element, 0)

export function getHorizon(networkPassphrase: string): Server {
  switch (networkPassphrase) {
    case networkPassphrases.mainnet:
      return horizonServers.mainnet
    case networkPassphrases.testnet:
      return horizonServers.testnet
    default:
      throw new Error(`Unknown network passphrase: ${networkPassphrase}`)
  }
}

export function selectStellarNetwork(networkPassphrase: string) {
  switch (networkPassphrase) {
    case networkPassphrases.mainnet:
      Network.usePublicNetwork()
      break
    case networkPassphrases.testnet:
      Network.useTestNetwork()
      break
    default:
      throw new Error(`Unknown network passphrase: "${networkPassphrase}"`)
  }
}

export function getAllSources(tx: Transaction) {
  return dedupe([
    tx.source,
    ...(tx.operations
      .map(operation => operation.source)
      .filter(source => Boolean(source)) as string[])
  ])
}

export function getAllSigners(accounts: AccountResponse[]) {
  return accounts.reduce(
    (signers, sourceAccount) =>
      dedupe([
        ...signers,
        ...sourceAccount.signers
          .filter(signer => signer.weight > 0)
          .map(signer => signer.public_key)
      ]),
    [] as string[]
  )
}

export function signatureMatchesPublicKey(
  signature: xdr.DecoratedSignature,
  publicKey: string
): boolean {
  const hint = (signature as SignatureWithHint).hint()
  const keypair = Keypair.fromPublicKey(publicKey)

  return hint.equals(keypair.rawPublicKey().slice(-hint.byteLength))
}

export function hasSufficientSignatures(
  account: AccountResponse,
  signatures: xdr.DecoratedSignature[],
  threshold: number = account.thresholds.high_threshold
) {
  // FIXME: Select correct threshold

  const effectiveSignatureWeights = account.signers
    .filter(signer =>
      signatures.some(signature => signatureMatchesPublicKey(signature, signer.public_key))
    )
    .map(signer => signer.weight)

  return sum(effectiveSignatureWeights) >= threshold
}

export function collateTransactionSignatures(
  tx: Transaction,
  additionalSignaturesBase64: string[]
) {
  const collatedTx = new Transaction(
    tx
      .toEnvelope()
      .toXDR()
      .toString("base64")
  )

  const prevSignaturesBase64 = tx.signatures.map(signature => signature.toXDR().toString("base64"))
  const newSignaturesBase64 = additionalSignaturesBase64.filter(
    signatureBase64 => !prevSignaturesBase64.includes(signatureBase64)
  )

  for (const signatureBase64 of newSignaturesBase64) {
    const signatureBuffer = Buffer.from(signatureBase64, "base64")
    const decoratedSignature = (xdr.DecoratedSignature as any).fromXDR(signatureBuffer)
    collatedTx.signatures.push(decoratedSignature)
  }

  return collatedTx
}
