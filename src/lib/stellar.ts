import { AccountResponse, Horizon, Keypair, Networks, Server, Transaction, xdr } from "stellar-sdk"

import { horizonServers } from "../config"

const dedupe = <T>(array: T[]) => [...new Set(array)]
const sum = (array: number[]) => array.reduce((total, element) => total + element, 0)

const getSignerKey = (signer: Horizon.AccountSigner): string => signer.key

export function getHorizon(networkPassphrase: Networks): Server {
  switch (networkPassphrase) {
    case Networks.PUBLIC:
      return horizonServers.pubnet
    case Networks.TESTNET:
      return horizonServers.testnet
    default:
      throw new Error(`Unknown network passphrase: ${networkPassphrase}`)
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
          .map(signer => getSignerKey(signer))
      ]),
    [] as string[]
  )
}

export function signatureMatchesPublicKey(
  signature: xdr.DecoratedSignature,
  publicKey: string
): boolean {
  const hint = signature.hint()
  const keypair = Keypair.fromPublicKey(publicKey)

  return hint.equals(keypair.signatureHint() as Buffer)
}

export function hasSufficientSignatures(
  account: AccountResponse,
  signatures: xdr.DecoratedSignature[],
  threshold: number = account.thresholds.high_threshold
) {
  // FIXME: Select correct threshold

  const effectiveSignatureWeights = account.signers
    .filter(signer =>
      signatures.some(signature => signatureMatchesPublicKey(signature, getSignerKey(signer)))
    )
    .map(signer => signer.weight)

  const weightSum = sum(effectiveSignatureWeights)
  return weightSum >= threshold && weightSum !== 0
}

function containsSignature(haystack: xdr.DecoratedSignature[], needle: xdr.DecoratedSignature) {
  const bufferHaystack = haystack.map(signature => signature.toXDR())
  const bufferNeedle = needle.toXDR()
  return bufferHaystack.some(buffer => buffer.equals(bufferNeedle))
}

export function collateTransactionSignatures(
  network: Networks,
  tx: Transaction,
  additionalSignatures: xdr.DecoratedSignature[]
) {
  const base64TxXdr = tx
    .toEnvelope()
    .toXDR()
    .toString("base64")

  const collatedTx = new Transaction(base64TxXdr, network)

  const prevSignatures = tx.signatures
  const newSignatures = additionalSignatures.filter(
    signature => !containsSignature(prevSignatures, signature)
  )

  for (const newSignature of newSignatures) {
    collatedTx.signatures.push(newSignature)
  }

  return collatedTx
}
