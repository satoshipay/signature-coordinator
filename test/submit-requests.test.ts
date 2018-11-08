import test from "ava"
import { createHash } from "crypto"
import request, { Response } from "supertest"
import { Keypair, Operation } from "stellar-sdk"

import { createSignatureRequestURI } from "../src/lib/sep-0007"
import { withApp } from "./_helpers/bootstrap"
import { recordEventStream } from "./_helpers/event-stream"
import { createTransaction, horizon, topup } from "./_helpers/transactions"
import { networkPassphrases } from "../src/lib/stellar"

const multisigAccountKeypair = Keypair.random()
const cosignerKeypair = Keypair.random()
const someOtherKeypair = Keypair.random()

function sha256(requestURI: string) {
  const hash = createHash("sha256")
  hash.update(requestURI, "utf8")
  return hash.digest("hex")
}

test.before(async () => {
  console.log("Request submission tests")
  console.log("  Multisig account:", multisigAccountKeypair.publicKey())
  console.log("  Cosigner pubkey:", cosignerKeypair.publicKey())

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
    const urlFormattedRequest = createSignatureRequestURI(tx, {
      network_passphrase: networkPassphrases.testnet
    })

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
    t.is(cosignerResponse.body[0].hash, sha256(urlFormattedRequest))
    t.true(cosignerResponse.body[0].request_uri.startsWith(urlFormattedRequest + "&callback="))
    t.is(cosignerResponse.body[0]._embedded.signers.length, 2)
    t.is(
      cosignerResponse.body[0]._embedded.signers.filter((signer: any) => signer.has_signed).length,
      1
    )

    const sourceResponse = await request(server)
      .get(`/requests/${multisigAccountKeypair.publicKey()}`)
      .expect(200)

    t.is(sourceResponse.body.length, 1, "Expected one signature request for the source public key.")
    t.is(
      sourceResponse.body[0]._embedded.signers.find(
        (signer: any) => signer.account_id === multisigAccountKeypair.publicKey()
      ).has_signed,
      true
    )
    t.true(sourceResponse.body[0].request_uri.startsWith(urlFormattedRequest + "&callback="))

    const streamedEvents = eventStreamRecording.stop()
    t.is(streamedEvents.length, 1, "Expected one streamed event to be recorded.")

    t.is(typeof streamedEvents[0].data, "object")
    t.true(
      streamedEvents[0].data._embedded.signers &&
        Array.isArray(streamedEvents[0].data._embedded.signers)
    )
  }))

test("signature request submission is idempotent", async t =>
  withApp(async ({ server }) => {
    const tx = await createTransaction(multisigAccountKeypair, [
      Operation.createAccount({
        destination: someOtherKeypair.publicKey(),
        startingBalance: "1.0"
      })
    ])

    const urlFormattedRequest = createSignatureRequestURI(tx, {
      network_passphrase: networkPassphrases.testnet
    })

    const firstSubmissionResponse = await request(server)
      .post("/submit")
      .set("Content-Type", "text/plain")
      .send(urlFormattedRequest)
      .expect((response: Response) => {
        t.is(response.status, 200, response.body.message || response.text)
      })

    t.is(firstSubmissionResponse.body.hash, sha256(urlFormattedRequest))

    const secondSubmissionResponse = await request(server)
      .post("/submit")
      .set("Content-Type", "text/plain")
      .send(urlFormattedRequest)
      .expect((response: Response) => {
        t.is(response.status, 200, response.body.message || response.text)
      })

    t.is(secondSubmissionResponse.body.hash, sha256(urlFormattedRequest))

    const cosignerResponse = await request(server)
      .get(`/requests/${cosignerKeypair.publicKey()}`)
      .expect(200)

    t.is(
      cosignerResponse.body.length,
      1,
      "Expected one signature request for the cosigner public key."
    )
    t.true(cosignerResponse.body[0].request_uri.startsWith(urlFormattedRequest + "&callback="))
    t.is(cosignerResponse.body[0]._embedded.signers.length, 2)
    t.is(
      cosignerResponse.body[0]._embedded.signers.filter((signer: any) => signer.has_signed).length,
      1
    )
  }))
