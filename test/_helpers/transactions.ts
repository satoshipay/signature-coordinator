import { TransactionStellarUri } from "@stellarguard/stellar-uri"
import axios from "axios"
import qs from "qs"
import {
  Keypair,
  Networks,
  Operation,
  Server,
  SignerOptions,
  Transaction,
  TransactionBuilder,
  xdr
} from "stellar-sdk"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function fail(message: string): never {
  throw new Error(message)
}

const horizonURL = process.env.HORIZON_TESTNET || fail("No HORIZON_TESTNET set.")
export const horizon = new Server(horizonURL)

type AccountInitializer = (keypair: Keypair) => any

const testAccountKeypairs: Keypair[] = []
const testAccountInitializers = new WeakMap<Keypair, AccountInitializer>()
let uninitializedTestAccounts: Keypair[] = []

export function leaseTestAccount(init: AccountInitializer = () => undefined) {
  const keypair = Keypair.random()
  testAccountKeypairs.push(keypair)
  testAccountInitializers.set(keypair, init)
  uninitializedTestAccounts.push(keypair)
  return keypair
}

export async function initializeTestAccounts() {
  const keypairsToInitialize = uninitializedTestAccounts

  const results = await Promise.all(
    keypairsToInitialize.map(async keypair => {
      const initialize = testAccountInitializers.get(keypair)!
      return initialize(keypair)
    })
  )

  uninitializedTestAccounts = []
  return results
}

export async function topup(accountID: string) {
  await axios.get(`${horizonURL}/friendbot?addr=${accountID}`)
  // Wait a little bit, so the horizon can catch-up, in case the friendbot used a different horizon
  await delay(750)
}

export async function prepareTestnetAccount(
  accountKeypair: Keypair,
  keyWeightThreshold: number = 1,
  cosigners: string[] = []
) {
  await topup(accountKeypair.publicKey())

  const setupTx = await buildTransaction(Networks.TESTNET, accountKeypair.publicKey(), [
    Operation.setOptions({
      lowThreshold: keyWeightThreshold,
      medThreshold: keyWeightThreshold,
      highThreshold: keyWeightThreshold
    }),
    ...cosigners.map(cosigner =>
      Operation.setOptions<SignerOptions.Ed25519PublicKey>({
        signer: {
          ed25519PublicKey: cosigner,
          weight: 1
        }
      })
    )
  ])

  setupTx.sign(accountKeypair)
  await horizon.submitTransaction(setupTx)
}

export async function buildTransaction(
  network: Networks,
  accountID: string,
  operations: xdr.Operation<any>[],
  options?: Partial<TransactionBuilder.TransactionBuilderOptions>
) {
  if (options && options.timebounds && !options.timebounds.minTime) {
    options.timebounds.minTime = 0
  }

  const account = await horizon.loadAccount(accountID)
  const txBuilder = new TransactionBuilder(account, {
    fee: 100,
    ...options,
    networkPassphrase: network
  })

  for (const operation of operations) {
    txBuilder.addOperation(operation)
  }

  if (!options || !options.timebounds || !options.timebounds.maxTime) {
    txBuilder.setTimeout(60)
  }

  return txBuilder.build()
}

export function buildTransactionURI(network: Networks, transaction: Transaction) {
  const uri = TransactionStellarUri.forTransaction(transaction)
  uri.networkPassphrase = network
  return uri
}

/** @deprecated Used for v0 tests only. */
export async function createTransaction(
  network: Networks,
  accountKeypair: Keypair,
  operations: xdr.Operation<any>[]
) {
  const account = await horizon.loadAccount(accountKeypair.publicKey())
  const txBuilder = new TransactionBuilder(account, { fee: "100", networkPassphrase: network })

  for (const operation of operations) {
    txBuilder.addOperation(operation)
  }

  txBuilder.setTimeout(60)
  const tx = txBuilder.build()

  tx.sign(accountKeypair)

  return tx
}

export function cosignSignatureRequest(
  network: Networks,
  requestURI: string,
  cosignerKeypair: Keypair
) {
  const requestParams = qs.parse(requestURI.replace(/^.*\?/, ""))

  const rehydratedTx = new Transaction(requestParams.xdr, network)
  rehydratedTx.sign(cosignerKeypair)

  if (!requestParams.callback) {
    throw new Error(`Expected "callback" parameter in co-signature request URI.`)
  }

  return {
    collateURL: requestParams.callback.replace(/^url:/, ""),
    cosignedTx: rehydratedTx
  }
}
