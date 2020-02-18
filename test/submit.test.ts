import test from "ava"
import { createHash } from "crypto"
import { Asset, Keypair, Networks, Operation } from "stellar-sdk"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests } from "./_helpers/seed"
import {
  buildTransaction,
  buildTransactionURI,
  initializeTestAccounts,
  leaseTestAccount,
  prepareTestnetAccount,
  topup
} from "./_helpers/transactions"
import { querySignatureRequestByHash } from "../src/models/signature-request"

const destination = leaseTestAccount(kp => prepareTestnetAccount(kp))
const source = leaseTestAccount(kp =>
  prepareTestnetAccount(kp, 2, [randomCosigner.publicKey(), keypair.publicKey()])
)

const keypair = leaseTestAccount(kp => topup(kp.publicKey()))
const randomCosigner = Keypair.random()

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  await initializeTestAccounts()
})

test("can submit a sufficiently signed tx to horizon", t =>
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

test.todo("can submit a sufficiently signed tx to an arbitrary URL")
