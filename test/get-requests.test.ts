import test from "ava"
import { Pool } from "pg"
import request from "supertest"

import { saveSigner } from "../src/models/signer"
import { createSignatureRequest, SignatureRequest } from "../src/models/signature-request"
import { withApp } from "./_helpers/bootstrap"

async function seed(database: Pool) {
  const signatureRequests: SignatureRequest[] = [
    {
      id: "c6acda04-8bad-4b21-8e04-f6756626f66f",
      hash: "5ff3c444485038e077ab02102ea0915ab6f6be9a44ca95d9115010767e2a6ed2",
      created_at: new Date(),
      updated_at: new Date(),
      completed_at: new Date(),
      designated_coordinator: true,
      request_uri:
        "web+stellar:tx?xdr=AAAAAL6Qe0ushP7lzogR2y3vyb8LKiorvD1U2KIlfs1wRBliAAAAZAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAABEz4bSpWmsmrXcIVAkY2hM3VdeCBJse56M18LaGzHQUAAAAAAAAAAACadvgAAAAAAAAAAA",
      source_account_id: "GC7JA62LVSCP5ZOORAI5WLPPZG7QWKRKFO6D2VGYUISX5TLQIQMWEIY3"
    },
    {
      id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
      hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
      created_at: new Date(),
      updated_at: new Date(),
      completed_at: new Date(),
      designated_coordinator: true,
      request_uri:
        "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
      source_account_id: "GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU"
    }
  ]
  const cosigners = [
    {
      signature_request: "c6acda04-8bad-4b21-8e04-f6756626f66f",
      account_id: "GAHPOF5MB7V4HGHUVMP3VCJUEJ4KFNNJNUR7IXETYW2XCQPEIOVEQE6E",
      has_signed: false
    },
    {
      signature_request: "c6acda04-8bad-4b21-8e04-f6756626f66f",
      account_id: "GARIJBBMTB735VSKWHRHFAL24M3FDFSWTIOJXJGGCKAXQLZ6MFSDZGQQ",
      has_signed: true
    }
  ]

  await Promise.all(
    signatureRequests.map(signatureRequest => createSignatureRequest(database, signatureRequest))
  )
  await Promise.all(cosigners.map(cosigner => saveSigner(database, cosigner)))
}

test("can list pending requests by source", async t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get("/requests/GC7JA62LVSCP5ZOORAI5WLPPZG7QWKRKFO6D2VGYUISX5TLQIQMWEIY3")
      .expect(200)

    t.is(response.body.length, 1)
    t.true(
      response.body[0].request_uri.startsWith(
        "web+stellar:tx?xdr=AAAAAL6Qe0ushP7lzogR2y3vyb8LKiorvD1U2KIlfs1wRBliAAAAZAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAABEz4bSpWmsmrXcIVAkY2hM3VdeCBJse56M18LaGzHQUAAAAAAAAAAACadvgAAAAAAAAAAA&callback="
      )
    )
    t.is(response.body[0]._embedded.signers.length, 2)
    t.is(response.body[0]._embedded.signers.filter((signer: any) => signer.has_signed).length, 1)
  }))

test("can list pending requests by co-signer", async t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get(
        "/requests/GAHPOF5MB7V4HGHUVMP3VCJUEJ4KFNNJNUR7IXETYW2XCQPEIOVEQE6E,GBPBFWVBADSESGADWEGC7SGTHE3535FWK4BS6UW3WMHX26PHGIH5NF4W"
      )
      .expect(200)

    t.is(response.body.length, 1)
    t.true(
      response.body[0].request_uri.startsWith(
        "web+stellar:tx?xdr=AAAAAL6Qe0ushP7lzogR2y3vyb8LKiorvD1U2KIlfs1wRBliAAAAZAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAABEz4bSpWmsmrXcIVAkY2hM3VdeCBJse56M18LaGzHQUAAAAAAAAAAACadvgAAAAAAAAAAA&callback="
      )
    )
    t.is(response.body[0]._embedded.signers.length, 2)
    t.is(
      response.body[0]._embedded.signers.find(
        (signer: any) =>
          signer.account_id === "GAHPOF5MB7V4HGHUVMP3VCJUEJ4KFNNJNUR7IXETYW2XCQPEIOVEQE6E"
      ).has_signed,
      false
    )
    t.is(response.body[0]._embedded.signers.filter((signer: any) => signer.has_signed).length, 1)
  }))
