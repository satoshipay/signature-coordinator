import test from "ava"
import { createHash } from "crypto"
import { Asset, Networks, Operation } from "stellar-sdk"
import request from "supertest"
import { querySignatureRequestSignatures } from "../src/models/signature"
import { querySignatureRequestByHash } from "../src/models/signature-request"
import { queryAllSignatureRequestSigners } from "../src/models/signer"
import { withApp } from "./_helpers/bootstrap"
import {
  buildTransaction,
  buildTransactionURI,
  initializeTestAccounts,
  leaseTestAccount,
  prepareTestnetAccount
} from "./_helpers/transactions"

const keypair = leaseTestAccount(kp =>
  prepareTestnetAccount(kp, 1, ["GBLHBKLMPZ5F5ACPSVDLSE6UUQTGTJJ36RNUN6D2EQU3JHQBG6CMFLXL"])
)

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  await initializeTestAccounts()
})

test("can create a request", t =>
  withApp(async ({ database, server }) => {
    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = tx.getKeypairSignature(keypair)

    const response = await request(server)
      .post("/transactions")
      .send({
        pubkey: keypair.publicKey(),
        req,
        signature
      })
      .expect(200)

    t.is(response.body.hash, sha256(req))
    t.true(
      response.body.req.includes(
        `callback=${encodeURIComponent(
          `url:http://localhost:3000/transactions/${response.body.hash}/signatures`
        )}`
      )
    )
    t.deepEqual(response.body.signed_by, [keypair.publicKey()])
    t.is(response.body.status, "pending")

    const record = await querySignatureRequestByHash(database, sha256(req))
    if (!record) {
      return t.fail(`Record not found for hash: ${sha256(req)}`)
    }

    t.is(record.hash, sha256(req))
    t.is(record.expires_at.getTime(), Number.parseInt(tx.timeBounds!.maxTime, 10) * 1000)
    t.assert(
      record.created_at.getTime() >= Date.now() - 1000 && record.created_at.getTime() <= Date.now()
    )

    const keypairFirst = (a: any) => (a.account_id === keypair.publicKey() ? -1 : 1)
    const signers = (await queryAllSignatureRequestSigners(database, record.id)).sort(keypairFirst)

    t.deepEqual(signers, [
      {
        account_id: keypair.publicKey(),
        key_weight: 1,
        signature_request: record.id,
        source_account_id: keypair.publicKey()
      },
      {
        account_id: "GBLHBKLMPZ5F5ACPSVDLSE6UUQTGTJJ36RNUN6D2EQU3JHQBG6CMFLXL",
        key_weight: 1,
        signature_request: record.id,
        source_account_id: keypair.publicKey()
      }
    ])

    const signatures = await querySignatureRequestSignatures(database, record.id)

    t.is(signatures.length, 1)
    t.is(signatures[0].signature, signature)
    t.is(signatures[0].signer_account_id, keypair.publicKey())
  }))

test("cannot submit a request with a tx xdr containing a signature", t =>
  withApp(async ({ server }) => {
    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const signature = tx.getKeypairSignature(keypair)
    tx.addSignature(keypair.publicKey(), signature)

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await request(server)
      .post("/transactions")
      .send({
        pubkey: keypair.publicKey(),
        req,
        signature
      })
      .expect(400)

    t.pass()
  }))

test("rejects a request that has already timed out", t =>
  withApp(async ({ server }) => {
    const tx = await buildTransaction(
      Networks.TESTNET,
      keypair.publicKey(),
      [
        Operation.payment({
          amount: "1.0",
          asset: Asset.native(),
          destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
        })
      ],
      {
        timebounds: {
          maxTime: Date.now() - 1000
        }
      }
    )

    const signature = tx.getKeypairSignature(keypair)
    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await request(server)
      .post("/transactions")
      .send({
        pubkey: keypair.publicKey(),
        req,
        signature
      })
      .expect(400)

    t.pass()
  }))

test("rejects a transaction with a too-late upper timebound", t =>
  withApp(async ({ server }) => {
    const tx = await buildTransaction(
      Networks.TESTNET,
      keypair.publicKey(),
      [
        Operation.payment({
          amount: "1.0",
          asset: Asset.native(),
          destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
        })
      ],
      {
        timebounds: {
          maxTime: Date.now() + 100 * 24 * 3600_000
        }
      }
    )

    const signature = tx.getKeypairSignature(keypair)
    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await request(server)
      .post("/transactions")
      .send({
        pubkey: keypair.publicKey(),
        req,
        signature
      })
      .expect(400)

    t.pass()
  }))
