import createError from "http-errors"
import qs from "qs"
import { Transaction } from "stellar-sdk"

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

export interface TxParameters {
  xdr: string
  callback?: string
  pubkey?: string
  msg?: string
  network_passphrase?: string
  origin_domain?: string
  signature?: string
}

export function createSignatureRequestURI(
  tx: Transaction,
  options: Omit<TxParameters, "xdr"> = {}
): string {
  const xdr = tx
    .toEnvelope()
    .toXDR()
    .toString("base64")

  const query: { [paramName: string]: string | undefined } = {
    ...options,
    xdr
  }
  return "web+stellar:tx?" + qs.stringify(query)
}

export function patchSignatureRequestURIParameters(
  signatureRequestURI: string,
  updatedParams: Partial<TxParameters>
) {
  const [header, queryString] = signatureRequestURI.split("?", 2)
  const patchedParameters = { ...qs.parse(queryString), ...updatedParams }

  return header + "?" + qs.stringify(patchedParameters)
}

function validateParameters(parameters: any): TxParameters {
  if (!parameters.xdr) {
    throw createError(400, "Missing mandatory parameter in request URI: xdr")
  }

  return parameters
}

export function parseRequestURL(requestURI: string) {
  if (!requestURI.startsWith("web+stellar:")) {
    throw createError(400, "Expected request to start with 'web+stellar:'")
  }

  const [operation, queryString] = requestURI.replace(/^web\+stellar:/, "").split("?", 2)
  const parameters = qs.parse(queryString)

  if (operation !== "tx") {
    throw createError(400, "This endpoint supports the 'tx' operation only.")
  }

  return {
    operation,
    parameters: validateParameters(parameters)
  }
}
