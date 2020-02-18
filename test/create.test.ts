import test from "ava"
import { createHash } from "crypto"
import { Asset, Keypair, Networks, Operation } from "stellar-sdk"
import request from "supertest"
import { querySignatureRequestSignatures } from "../src/models/signature"
import { querySignatureRequestByHash } from "../src/models/signature-request"
import { queryAllSignatureRequestSigners } from "../src/models/signer"
import { withApp } from "./_helpers/bootstrap"
import {
  buildTransaction,
  buildTransactionURI,
  prepareTestnetAccount
} from "./_helpers/transactions"

function sha256(text: string): string {
  const hash = createHash("sha256")
  hash.update(text, "utf8")
  return hash.digest("hex")
}

test("can submit a request", t =>
  withApp(async ({ database, server }) => {
    const keypair = Keypair.random()

    await prepareTestnetAccount(keypair, 1, [
      "GBLHBKLMPZ5F5ACPSVDLSE6UUQTGTJJ36RNUN6D2EQU3JHQBG6CMFLXL"
    ])

    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()
    const signature = keypair.sign(tx.signatureBase())

    const response = await request(server)
      .post("/create")
      .send({
        hash: sha256(req),
        pibkey: keypair.publicKey(),
        req,
        signature: signature.toString("base64")
      })
      .expect(201)

    t.is(response.header.location, `http://localhost:3000/status/${sha256(req)}`)

    const record = await querySignatureRequestByHash(database, sha256(req))
    if (!record) {
      return t.fail(`Record not found for hash: ${sha256(req)}`)
    }

    t.is(record.hash, sha256(req))
    t.is(record.expires_at, null)
    t.assert(
      Date.parse(record.created_at) >= Date.now() - 1000 &&
        Date.parse(record.created_at) <= Date.now()
    )

    const signers = await queryAllSignatureRequestSigners(database, record.id)
    t.deepEqual(signers, [
      {
        account_id: keypair.publicKey(),
        key_weight: 1,
        signature_request: record.id,
        source_account_id: keypair.publicKey()
      },
      {
        account_id: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU",
        key_weight: 1,
        signature_request: record.id,
        source_account_id: keypair.publicKey()
      }
    ])

    const signatures = await querySignatureRequestSignatures(database, record.hash)
    t.is(signatures.length, 1)
    t.is(signatures[0].signature, signature.toString("base64"))
    t.is(signatures[0].signer_account_id, keypair.publicKey())
  }))

test("cannot submit a request with a tx xdr containing a signature", () =>
  withApp(async ({ server }) => {
    const keypair = Keypair.random()

    await prepareTestnetAccount(keypair, 1, [
      "GBLHBKLMPZ5F5ACPSVDLSE6UUQTGTJJ36RNUN6D2EQU3JHQBG6CMFLXL"
    ])

    const tx = await buildTransaction(Networks.TESTNET, keypair.publicKey(), [
      Operation.payment({
        amount: "1.0",
        asset: Asset.native(),
        destination: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
      })
    ])

    const signature = keypair.sign(tx.signatureBase())
    tx.addSignature(keypair.publicKey(), signature.toString("base64"))

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await request(server)
      .post("/create")
      .send({
        hash: sha256(req),
        pibkey: keypair.publicKey(),
        req,
        signature: signature.toString("base64")
      })
      .expect(400)
  }))

test("rejects a request that has already timed out", () =>
  withApp(async ({ server }) => {
    const keypair = Keypair.random()

    await prepareTestnetAccount(keypair, 1, [
      "GBLHBKLMPZ5F5ACPSVDLSE6UUQTGTJJ36RNUN6D2EQU3JHQBG6CMFLXL"
    ])

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

    const signature = keypair.sign(tx.signatureBase())
    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await request(server)
      .post("/create")
      .send({
        hash: sha256(req),
        pibkey: keypair.publicKey(),
        req,
        signature: signature.toString("base64")
      })
      .expect(400)
  }))

test("rejects a transaction with a too-late upper timebound", () =>
  withApp(async ({ server }) => {
    const keypair = Keypair.random()

    await prepareTestnetAccount(keypair, 1, [
      "GBLHBKLMPZ5F5ACPSVDLSE6UUQTGTJJ36RNUN6D2EQU3JHQBG6CMFLXL"
    ])

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

    const signature = keypair.sign(tx.signatureBase())
    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    await request(server)
      .post("/create")
      .send({
        hash: sha256(req),
        pibkey: keypair.publicKey(),
        req,
        signature: signature.toString("base64")
      })
      .expect(400)
  }))
