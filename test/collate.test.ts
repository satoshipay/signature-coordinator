import test from "ava"
import { createHash } from "crypto"
import { Asset, Keypair, Networks, Operation } from "stellar-sdk"
import request from "supertest"
import { querySignatureRequestSignatures } from "../src/models/signature"
import { querySignatureRequestByHash } from "../src/models/signature-request"
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

const keypair = leaseTestAccount(kp => topup(kp.publicKey()))
const randomCosigner = Keypair.random()

const source1 = leaseTestAccount(kp =>
  prepareTestnetAccount(kp, 3, [randomCosigner.publicKey(), keypair.publicKey()])
)
const source2 = leaseTestAccount(kp =>
  prepareTestnetAccount(kp, 2, [randomCosigner.publicKey(), keypair.publicKey()])
)

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  await initializeTestAccounts()
})

test("can collate an additional signature", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, source1.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])
    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.hash()).toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z"),
          updated_at: new Date("2019-12-03T12:10:00Z"),
          req,
          status: "pending"
        } as const,
        signatures: [
          {
            signer: source1.publicKey(),
            xdr: source1.sign(tx.hash()).toString("base64")
          }
        ]
      }
    ])

    await request(server)
      .post(`/transactions/${sha256(req)}/signatures`)
      .send({
        pubkey: keypair.publicKey(),
        signature
      })
      .expect(204)

    // TODO: Check response body

    const updatedSignatures = await querySignatureRequestSignatures(
      database,
      "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c"
    )

    t.deepEqual(updatedSignatures, [
      {
        created_at: updatedSignatures[0]?.created_at,
        signature_request: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        signer_account_id: source1.publicKey(),
        signature: source1.sign(tx.hash()).toString("base64")
      },
      {
        created_at: updatedSignatures[1]?.created_at,
        signature_request: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        signer_account_id: keypair.publicKey(),
        signature
      }
    ])
  }))

test("changes status to 'ready' when sufficiently signed", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, source2.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.hash()).toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z"),
          updated_at: new Date("2019-12-03T12:10:00Z"),
          req,
          status: "pending"
        } as const,
        signatures: [
          {
            signer: source2.publicKey(),
            xdr: source2.sign(tx.hash()).toString("base64")
          }
        ]
      }
    ])

    await request(server)
      .post(`/transactions/${sha256(req)}/signatures`)
      .send({
        pubkey: keypair.publicKey(),
        signature
      })
      .expect(204)

    const signatureRequest = await querySignatureRequestByHash(database, sha256(req))
    t.is(signatureRequest?.status, "ready")
  }))

test("rejects an invalid signature", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, source1.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const badSignature = keypair
      .sign(Buffer.concat([tx.hash(), Buffer.alloc(4)]))
      .toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z"),
          updated_at: new Date("2019-12-03T12:10:00Z"),
          req,
          status: "pending"
        } as const,
        signatures: [
          {
            signer: source1.publicKey(),
            xdr: source1.sign(tx.hash()).toString("base64")
          }
        ]
      }
    ])

    await request(server)
      .post(`/transactions/${sha256(req)}/signatures`)
      .send({
        pubkey: keypair.publicKey(),
        signature: badSignature
      })
      .expect(400)

    t.pass()
  }))

test.todo("rejects a signature of a key who is not a co-signer")

test("rejects additional signature for a sufficiently-signed tx", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, source2.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.hash()).toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z"),
          updated_at: new Date("2019-12-03T12:10:00Z"),
          req,
          status: "ready"
        } as const,
        signatures: [
          {
            signer: source2.publicKey(),
            xdr: source2.sign(tx.hash()).toString("base64")
          },
          {
            signer: randomCosigner.publicKey(),
            xdr: randomCosigner.sign(tx.hash()).toString("base64")
          }
        ]
      }
    ])

    await request(server)
      .post(`/transactions/${sha256(req)}/signatures`)
      .send({
        pubkey: keypair.publicKey(),
        signature
      })
      .expect(400)

    t.pass()
  }))
