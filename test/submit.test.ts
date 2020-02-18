import test from "ava"
import { createHash } from "crypto"
import { Asset, Keypair, Networks, Operation } from "stellar-sdk"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests } from "./_helpers/seed"
import {
  buildTransaction,
  buildTransactionURI,
  prepareTestnetAccount
} from "./_helpers/transactions"

const destination = Keypair.random()
const source = Keypair.random()

const keypair = Keypair.random()
const randomCosigner = Keypair.random()

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  await Promise.all([
    prepareTestnetAccount(destination),
    prepareTestnetAccount(source, 2, [randomCosigner.publicKey(), keypair.publicKey()])
  ])
})

test("can submit a sufficiently signed tx to horizon", t =>
  withApp(async ({ database, server }) => {
    const keypair = Keypair.random()
    const randomCosigner = Keypair.random()

    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
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
          created_at: new Date("2019-12-03T12:00:00Z").toISOString(),
          updated_at: new Date("2019-12-03T12:10:00Z").toISOString(),
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

    t.is(typeof response.body.envelope_xdr, "string")
    t.is(typeof response.body.hash, "string")
    t.is(typeof response.body.result_xdr, "string")
  }))

test.todo("can submit a sufficiently signed tx to an arbitrary URL")
