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

interface SignatureRequestParams extends SignatureRequestOptions {
  xdr: string
}

export function createSignatureRequestURI(
  tx: Transaction,
  options: SignatureRequestOptions = {}
): string {
  const xdr = tx
    .toEnvelope()
    .toXDR()
    .toString("base64")

  const query: { [paramName: string]: string | undefined } = {
    ...options,
    network: options.network ? options.network.networkPassphrase() : undefined,
    xdr
  }
  return "web+stellar:tx?" + qs.stringify(query)
}

export function patchSignatureRequestURIParameters(
  signatureRequestURI: string,
  updatedParams: Partial<SignatureRequestParams>
) {
  const [header, queryString] = signatureRequestURI.split("?", 2)
  const patchedParameters = { ...qs.parse(queryString), ...updatedParams }

  return header + "?" + qs.stringify(patchedParameters)
}
