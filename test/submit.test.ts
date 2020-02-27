import test from "ava"
import { createHash } from "crypto"
import { Asset, Keypair, Networks, Operation, Transaction } from "stellar-sdk"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests } from "./_helpers/seed"
import { createCallbackEndpoint } from "./_helpers/server"
import {
  buildTransaction,
  buildTransactionURI,
  fundMainnetAccount,
  getHorizon,
  initializeTestAccounts,
  leaseTestAccount,
  prepareTestnetAccount,
  topup,
  createTransaction
} from "./_helpers/transactions"
import { querySignatureRequestByHash } from "../src/models/signature-request"

const destination = leaseTestAccount(kp => prepareTestnetAccount(kp))
const source = leaseTestAccount(kp =>
  prepareTestnetAccount(kp, 2, [randomCosigner.publicKey(), keypair.publicKey()])
)

const keypair = leaseTestAccount(kp => topup(kp.publicKey()))
const randomCosigner = Keypair.random()

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  await initializeTestAccounts()
})

test("can submit a sufficiently signed tx to testnet horizon", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, source.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: destination.publicKey()
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z"),
          updated_at: new Date("2019-12-03T12:10:00Z"),
          expires_at: null,
          req,
          status: "pending"
        } as const,
        signatures: [
          {
            signer: source.publicKey(),
            xdr: source.sign(tx.hash()).toString("base64")
          },
          {
            signer: randomCosigner.publicKey(),
            xdr: randomCosigner.sign(tx.hash()).toString("base64")
          }
        ]
      }
    ])

    const response = await request(server)
      .post(`/submit/${sha256(req)}`)
      .expect(200)

    t.is(response.get("X-Submitted-To"), "https://horizon-testnet.stellar.org/transactions")

    t.is(typeof response.body.envelope_xdr, "string")
    t.is(typeof response.body.hash, "string")
    t.is(typeof response.body.result_xdr, "string")

    const signatureRequest = await querySignatureRequestByHash(database, sha256(req))

    t.is(signatureRequest?.status, "submitted")
    t.is(signatureRequest?.error, null)
    t.true(signatureRequest!.updated_at.getTime() > Date.now() - 1000)
  }))

test("can submit a sufficiently signed tx to pubnet horizon", t =>
  withApp(async ({ database, server }) => {
    const [refundSource, refundDestination] = await Promise.all([
      fundMainnetAccount(source, "3.0"),
      fundMainnetAccount(destination, "2.0")
    ])
    await delay(500)

    try {
      const multisigSetupTx = await createTransaction(Networks.PUBLIC, source, [
        Operation.setOptions({
          lowThreshold: 2,
          medThreshold: 2,
          highThreshold: 2,
          masterWeight: 1,
          signer: {
            ed25519PublicKey: randomCosigner.publicKey(),
            weight: 1
          },
          source: source.publicKey()
        })
      ])
      await getHorizon(Networks.PUBLIC).submitTransaction(multisigSetupTx)

      const tx = await buildTransaction(Networks.PUBLIC, source.publicKey(), [
        Operation.payment({
          amount: "1.0",
          asset: Asset.native(),
          destination: destination.publicKey()
        })
      ])

      const req = buildTransactionURI(Networks.PUBLIC, tx).toString()

      await seedSignatureRequests(database, [
        {
          request: {
            id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
            hash: sha256(req),
            created_at: new Date("2019-12-03T12:00:00Z"),
            updated_at: new Date("2019-12-03T12:10:00Z"),
            expires_at: null,
            req,
            status: "pending"
          } as const,
          signatures: [
            {
              signer: source.publicKey(),
              xdr: source.sign(tx.hash()).toString("base64")
            },
            {
              signer: randomCosigner.publicKey(),
              xdr: randomCosigner.sign(tx.hash()).toString("base64")
            }
          ]
        }
      ])

      const response = await request(server)
        .post(`/submit/${sha256(req)}`)
        .expect(200)

      t.is(response.get("X-Submitted-To"), "https://horizon.stellar.org/transactions")

      t.is(typeof response.body.envelope_xdr, "string")
      t.is(typeof response.body.hash, "string")
      t.is(typeof response.body.result_xdr, "string")

      const signatureRequest = await querySignatureRequestByHash(database, sha256(req))

      t.is(signatureRequest?.status, "submitted")
      t.is(signatureRequest?.error, null)
      t.true(signatureRequest!.updated_at.getTime() > Date.now() - 1000)
    } finally {
      await Promise.all([refundSource([randomCosigner]), refundDestination()])
    }
  }))

test("can submit a sufficiently signed tx to an arbitrary URL", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, source.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: destination.publicKey()
      })
    ])

    const endpoint = createCallbackEndpoint("/custom-tx-submission", (xdr, res) => {
      res.write("Received signed transaction: " + xdr)
      res.end()
    })

    const uri = buildTransactionURI(Networks.TESTNET, tx)
    uri.callback = endpoint.url
    const req = uri.toString()

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z"),
          updated_at: new Date("2019-12-03T12:10:00Z"),
          expires_at: null,
          req,
          status: "pending"
        } as const,
        signatures: [
          {
            signer: source.publicKey(),
            xdr: source.sign(tx.hash()).toString("base64")
          },
          {
            signer: randomCosigner.publicKey(),
            xdr: randomCosigner.sign(tx.hash()).toString("base64")
          }
        ]
      }
    ])

    const signedTxXdr = (() => {
      const signed = new Transaction(uri.xdr, Networks.TESTNET)
      signed.sign(source)
      signed.sign(randomCosigner)
      return signed
        .toEnvelope()
        .toXDR()
        .toString("base64")
    })()

    const response = await request(server)
      .post(`/submit/${sha256(req)}`)
      .expect(200)

    t.is(response.get("X-Submitted-To"), endpoint.url)
    t.deepEqual(endpoint.captured(), [signedTxXdr])

    t.is(response.text, `Received signed transaction: ${signedTxXdr}`)
  }))
