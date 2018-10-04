import qs from "qs"
import { Network, Transaction } from "stellar-sdk"

interface SignatureRequestOptions {
  callback?: string
  pubkey?: string
  msg?: string
  network?: Network
  origin_domain?: string
  signature?: string
}

export function createSignatureRequestURI(
  tx: Transaction,
  options: SignatureRequestOptions = {}
): string {
  const query: { [paramName: string]: string | undefined } = {
    ...options,
    network: options.network ? options.network.networkPassphrase() : undefined,
    xdr: tx
      .toEnvelope()
      .toXDR()
      .toString("base64")
  }
  return "web+stellar:tx?" + qs.stringify(query)
}
