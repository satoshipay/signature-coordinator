import test from "ava"
import request, { Response } from "supertest"
import { Keypair, Operation } from "stellar-sdk"
import URL from "url"

import { createSignatureRequestURI } from "../src/lib/sep-0007"
import { withApp } from "./_helpers/bootstrap"
import { recordEventStream } from "./_helpers/event-stream"
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
  withApp(async ({ config, server }) => {
    const tx = await createTransaction(multisigAccountKeypair, [
      Operation.createAccount({
        destination: someOtherKeypair.publicKey(),
        startingBalance: "10.0"
      })
    ])

    const eventStreamRecording = recordEventStream(
      `http://localhost:${config.port}/stream/${multisigAccountKeypair.publicKey()}`,
      ["signature-request"]
    )
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

    const streamedEvents = eventStreamRecording.stop()
    t.is(streamedEvents.length, 1, "Expected one streamed event to be recorded.")

    t.true(
      streamedEvents[0].data.signatureRequest &&
        typeof streamedEvents[0].data.signatureRequest === "object"
    )
    t.true(streamedEvents[0].data.signers && Array.isArray(streamedEvents[0].data.signers))
  }))

test("can submit a co-sig request and collate a 2nd signature", async t =>
  withApp(async ({ config, server }) => {
    const tx = await createTransaction(multisigAccountKeypair, [
      Operation.createAccount({
        destination: someOtherKeypair.publicKey(),
        startingBalance: "10.0"
      })
    ])

    const eventStreamRecording = recordEventStream(
      `http://localhost:${config.port}/stream/${cosignerKeypair.publicKey()}`,
      ["signature-request:submitted"]
    )
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

    const streamedEvents = eventStreamRecording.stop()
    t.is(streamedEvents.length, 1)

    t.truthy(streamedEvents[0].data.signatureRequest)
    t.is(
      streamedEvents[0].data.signatureRequest.source_account_id,
      multisigAccountKeypair.publicKey()
    )
  }))
