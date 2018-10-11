import axios from "axios"
import qs from "qs"
import { Keypair, Network, Server, Transaction, TransactionBuilder, xdr } from "stellar-sdk"

function fail(message: string): never {
  throw new Error(message)
}

const horizonURL = process.env.HORIZON_TESTNET || fail("No HORIZON_TESTNET set.")
export const horizon = new Server(horizonURL)

export async function topup(publicKey: string) {
  await axios.get(`${horizonURL}/friendbot?addr=${publicKey}`)
}

export async function createTransaction(accountKeypair: Keypair, operations: xdr.Operation<any>[]) {
  const account = await horizon.loadAccount(accountKeypair.publicKey())
  const txBuilder = new TransactionBuilder(account)

  for (const operation of operations) {
    txBuilder.addOperation(operation)
  }

  const tx = txBuilder.build()

  Network.useTestNetwork()
  tx.sign(accountKeypair)

  return tx
}

export function cosignSignatureRequest(requestURI: string, cosignerKeypair: Keypair) {
  const requestParams = qs.parse(requestURI.replace(/^.*\?/, ""))

  const rehydratedTx = new Transaction(requestParams.xdr)
  rehydratedTx.sign(cosignerKeypair)

  if (!requestParams.callback) {
    throw new Error(`Expected "callback" parameter in co-signature request URI.`)
  }

  return {
    collateURL: requestParams.callback.replace(/^url:/, ""),
    cosignedTx: rehydratedTx
  }
}
