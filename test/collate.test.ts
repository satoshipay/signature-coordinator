import test from "ava"
import { createHash } from "crypto"
import { Asset, Keypair, Networks, Operation } from "stellar-sdk"
import request from "supertest"
import { querySignatureRequestSignatures } from "../src/models/signature"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests } from "./_helpers/seed"
import {
  buildTransaction,
  buildTransactionURI,
  prepareTestnetAccount,
  topup
} from "./_helpers/transactions"

const source1 = Keypair.random()
const source2 = Keypair.random()

const keypair = Keypair.random()
const randomCosigner = Keypair.random()

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  await Promise.all([
    topup(keypair.publicKey()),
    prepareTestnetAccount(source1, 3, [randomCosigner.publicKey(), keypair.publicKey()]),
    prepareTestnetAccount(source2, 2, [randomCosigner.publicKey(), keypair.publicKey()])
  ])
})

test.only("can collate an additional signature", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])
    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.signatureBase()).toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z").toISOString(),
          updated_at: new Date("2019-12-03T12:10:00Z").toISOString(),
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
      .post(`/collate/${sha256(req)}`)
      .send({
        pubkey: keypair.publicKey(),
        signature
      })
      .expect(200)

    // TODO: Check response body

    const updatedSignatures = await querySignatureRequestSignatures(database, sha256(req))

    t.deepEqual(updatedSignatures, [
      {
        created_at: updatedSignatures[0].created_at,
        signature_request: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        signer_account_id: source1.publicKey(),
        signature: source1.sign(tx.hash()).toString("base64")
      },
      {
        created_at: updatedSignatures[1].created_at,
        signature_request: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        signer_account_id: keypair.publicKey(),
        signature
      },
      {
        created_at: updatedSignatures[2].created_at,
        signature_request: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        signer_account_id: randomCosigner.publicKey(),
        signature: null
      }
    ])
  }))

test("changes status to 'ready' when sufficiently signed", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.signatureBase()).toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z").toISOString(),
          updated_at: new Date("2019-12-03T12:10:00Z").toISOString(),
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

    const response = await request(server)
      .post(`/collate/${sha256(req)}`)
      .send({
        pubkey: keypair.publicKey(),
        signature
      })
      .expect(200)

    // TODO: Check whole response body
    t.is(response.body.status, "ready")
  }))

test("rejects an invalid signature", () =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const badSignature = keypair
      .sign(Buffer.concat([tx.signatureBase(), Buffer.alloc(4)]))
      .toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z").toISOString(),
          updated_at: new Date("2019-12-03T12:10:00Z").toISOString(),
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
      .post(`/collate/${sha256(req)}`)
      .send({
        pubkey: keypair.publicKey(),
        signature: badSignature
      })
      .expect(400)
  }))

test.todo("rejects a signature of a key who is not a co-signer")

test("rejects additional signature for a sufficiently-signed tx", () =>
  withApp(async ({ database, server }) => {
    const keypair = Keypair.random()
    const randomCosigner = Keypair.random()

    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.signatureBase()).toString("base64")

    await seedSignatureRequests(database, [
      {
        request: {
          id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
          hash: sha256(req),
          created_at: new Date("2019-12-03T12:00:00Z").toISOString(),
          updated_at: new Date("2019-12-03T12:10:00Z").toISOString(),
          req,
          status: "pending"
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
      .post(`/collate/${sha256(req)}`)
      .send({
        pubkey: keypair.publicKey(),
        signature
      })
      .expect(400)
  }))
