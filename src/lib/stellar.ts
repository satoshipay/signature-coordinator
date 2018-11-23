import { AccountResponse, Keypair, Network, Server, Transaction, xdr } from "stellar-sdk"

import { horizonServers } from "../config"

interface DecoratedSignature extends xdr.DecoratedSignature {
  signature(): Buffer
}

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

export function verifySignatures(tx: Transaction, signerAccountIDs: string[]) {
  for (const signature of tx.signatures as DecoratedSignature[]) {
    const signerPublicKey = signerAccountIDs.find(accountID =>
      signatureMatchesPublicKey(signature, accountID)
    )
    if (!signerPublicKey) {
      throw new Error(
        `Transaction signature verification failed. Found a signature from an unexpected signer.`
      )
    }
    const signerKeypair = Keypair.fromPublicKey(signerPublicKey)
    if (!signerKeypair.verify(tx.hash(), signature.signature())) {
      throw new Error(`Invalid signature: ${signature.toXDR().toString("base64")}`)
    }
  }
}

function containsSignature(haystack: xdr.DecoratedSignature[], needle: xdr.DecoratedSignature) {
  const bufferHaystack = haystack.map(signature => signature.toXDR())
  const bufferNeedle = needle.toXDR()
  return bufferHaystack.some(buffer => buffer.equals(bufferNeedle))
}

export function collateTransactionSignatures(
  tx: Transaction,
  additionalSignatures: xdr.DecoratedSignature[]
) {
  const collatedTx = new Transaction(
    tx
      .toEnvelope()
      .toXDR()
      .toString("base64")
  )

  const prevSignatures = tx.signatures
  const newSignatures = additionalSignatures.filter(
    signature => !containsSignature(prevSignatures, signature)
  )

  for (const newSignature of newSignatures) {
    collatedTx.signatures.push(newSignature)
  }

  return collatedTx
}
