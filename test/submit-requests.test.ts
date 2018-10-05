import test from "ava"
import request, { Response } from "supertest"
import { Keypair, Operation } from "stellar-sdk"
import URL from "url"

import { createSignatureRequestURI } from "../src/lib/sep-0007"
import { withApp } from "./_helpers/bootstrap"
import { cosignSignatureRequest, createTransaction, horizon, topup } from "./_helpers/transactions"

const multisigAccountKeypair = Keypair.random()
const cosignerKeypair = Keypair.random()
const someOtherKeypair = Keypair.random()

test.before(async () => {
  console.log("Multisig account:", multisigAccountKeypair.publicKey())
  console.log("Cosigner pubkey:", cosignerKeypair.publicKey())

  await topup(multisigAccountKeypair.publicKey())

  await horizon.submitTransaction(
    await createTransaction(multisigAccountKeypair, [
      Operation.setOptions({
        signer: {
          ed25519PublicKey: cosignerKeypair.publicKey(),
          weight: 1
        }
      }),
      Operation.setOptions({
        lowThreshold: 2,
        medThreshold: 2,
        highThreshold: 2
      })
    ])
  )
})

test("can submit a co-signature request", async t =>
  withApp(async ({ server }) => {
    const tx = await createTransaction(multisigAccountKeypair, [
      Operation.createAccount({
        destination: someOtherKeypair.publicKey(),
        startingBalance: "10.0"
      })
    ])

    const urlFormattedRequest = createSignatureRequestURI(tx)

    await request(server)
      .post("/submit")
      .set("Content-Type", "text/plain")
      .send(urlFormattedRequest)
      .expect((response: Response) => {
        t.is(response.status, 200, response.body.message || response.text)
      })

    const cosignerResponse = await request(server)
      .get(`/requests/${cosignerKeypair.publicKey()}`)
      .expect(200)

    t.is(
      cosignerResponse.body.length,
      1,
      "Expected one signature request for the cosigner public key."
    )
    t.is(cosignerResponse.body[0].account_role, "cosigner")
    t.true(cosignerResponse.body[0].request_uri.startsWith(urlFormattedRequest + "&callback="))
    t.is(cosignerResponse.body[0].signer_count, 2)
    t.is(cosignerResponse.body[0].signature_count, 1)

    const sourceResponse = await request(server)
      .get(`/requests/${multisigAccountKeypair.publicKey()}`)
      .expect(200)

    t.is(sourceResponse.body.length, 1, "Expected one signature request for the source public key.")
    t.is(sourceResponse.body[0].account_role, "source")
    t.true(sourceResponse.body[0].request_uri.startsWith(urlFormattedRequest + "&callback="))
  }))

test("can submit a co-sig request and collate a 2nd signature", async t =>
  withApp(async ({ server }) => {
    const tx = await createTransaction(multisigAccountKeypair, [
      Operation.createAccount({
        destination: someOtherKeypair.publicKey(),
        startingBalance: "10.0"
      })
    ])

    const urlFormattedRequest = createSignatureRequestURI(tx)

    await request(server)
      .post("/submit")
      .set("Content-Type", "text/plain")
      .send(urlFormattedRequest)
      .expect((response: Response) => {
        t.is(response.status, 200, response.body.message || response.text)
      })

    const cosignerQueryResponse = await request(server)
      .get(`/requests/${cosignerKeypair.publicKey()}`)
      .expect(200)

    t.is(
      cosignerQueryResponse.body.length,
      1,
      "Expected one signature request for the cosigner public key."
    )

    const requestURI =
      cosignerQueryResponse.body[0].request_uri ||
      t.fail("Expected signature request to contain a request_uri.")
    const { collateURL, cosignedTx } = cosignSignatureRequest(requestURI, cosignerKeypair)

    await request(server)
      .post(URL.parse(collateURL).pathname as string)
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send({
        xdr: cosignedTx
          .toEnvelope()
          .toXDR()
          .toString("base64")
      })
      .expect((response: Response) => {
        t.is(response.status, 200, response.body.message || response.text)
      })

    const someOtherAccount = await horizon.loadAccount(someOtherKeypair.publicKey())
    t.is(Number.parseFloat(someOtherAccount.balances[0].balance), 10)

    const cosignerQueryResponseAfter = await request(server)
      .get(`/requests/${cosignerKeypair.publicKey()}`)
      .expect((response: Response) => {
        t.is(response.status, 200, response.body.message || response.text)
      })

    t.is(
      cosignerQueryResponseAfter.body.length,
      0,
      "Expected no signature request to be returned for cosigner public key after submission.\nResponse: " +
        JSON.stringify(cosignerQueryResponseAfter.body, null, 2)
    )
  }))
