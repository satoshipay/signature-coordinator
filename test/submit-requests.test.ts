import test from "ava"
import request, { Response } from "supertest"
import { Keypair, Operation } from "stellar-sdk"

import { withApp } from "./_helpers/bootstrap"
import { createSignatureRequestURI } from "./_helpers/sep-0007"
import { createTransaction, horizon, topup } from "./_helpers/transactions"

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
    t.deepEqual(cosignerResponse.body, [
      {
        account_role: "cosigner",
        created_at: cosignerResponse.body[0].created_at,
        updated_at: cosignerResponse.body[0].updated_at,
        request_url: urlFormattedRequest,
        signer_count: 2,
        signature_count: 1
      }
    ])

    const sourceResponse = await request(server)
      .get(`/requests/${multisigAccountKeypair.publicKey()}`)
      .expect(200)

    t.is(sourceResponse.body.length, 1, "Expected one signature request for the source public key.")
    t.is(sourceResponse.body[0].account_role, "source")
    t.is(sourceResponse.body[0].request_url, urlFormattedRequest)
  }))
