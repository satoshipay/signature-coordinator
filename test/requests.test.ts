import test from "ava"
import { Keypair } from "stellar-sdk"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests, Pool } from "./_helpers/seed"

const source1 = Keypair.fromSecret("SATVL56DW2EVNPHDDO75ABL4CYLYK5NVA3T2AGVOTCMJ2I3WTS3DSRC2")
const source2 = Keypair.fromSecret("SCI7WEEI6CHW3BT5WW4U32WQZVUJZUXYGVABKC2525MVM2GZZRFTDEKX")
const txHash = Buffer.from(
  "bad2d517b2aef728f88bb05ef43ebc44b74ecc49322e84082487c186aa5b6831",
  "hex"
)

async function seed(database: Pool) {
  await seedSignatureRequests(database, [
    {
      request: {
        id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        created_at: new Date("2019-12-03T12:00:00Z").toISOString(),
        updated_at: new Date("2019-12-03T12:10:00Z").toISOString(),
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "pending"
      } as const,
      signatures: []
    },
    {
      request: {
        id: "7974897e-1230-4d12-8588-644c6cfeba23",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        created_at: new Date("2019-12-03T12:05:00Z").toISOString(),
        updated_at: new Date("2019-12-03T12:05:00Z").toISOString(),
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "submitted"
      } as const,
      signatures: [
        {
          signer: source1.publicKey(),
          xdr: source1.sign(txHash).toString("hex")
        }
      ]
    },
    {
      request: {
        id: "e51168fe-340b-44d4-a5c1-f0d78c878c4a",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        created_at: new Date("2019-12-03T11:00:00Z").toISOString(),
        updated_at: new Date("2019-12-03T11:00:00Z").toISOString(),
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "submitted"
      } as const,
      signatures: [
        {
          signer: source1.publicKey(),
          xdr: source1.sign(txHash).toString("hex")
        },
        {
          signer: source2.publicKey(),
          xdr: source2.sign(txHash).toString("hex")
        }
      ]
    },
    {
      request: {
        id: "c0e97896-a503-43f1-9554-ec0ef559895f",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        created_at: new Date("2019-12-03T10:00:00Z").toISOString(),
        updated_at: new Date("2019-12-03T10:00:00Z").toISOString(),
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "submitted"
      } as const,
      signatures: []
    }
  ])
}

test("can fetch latest requests", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get("/requests/GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU")
      .expect(200)

    t.deepEqual(response.body, [
      {
        cursor: "e51168fe-340b-44d4-a5c1-f0d78c878c4a",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "submitted",
        created_at: "2019-12-03T11:00:00Z",
        updated_at: "2019-12-03T11:00:00Z",
        expires_at: null
      },
      {
        cursor: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "pending",
        created_at: "2019-12-03T12:00:00Z",
        updated_at: "2019-12-03T12:10:00Z",
        expires_at: null
      },
      {
        cursor: "7974897e-1230-4d12-8588-644c6cfeba23",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "submitted",
        created_at: "2019-12-03T12:05:00Z",
        updated_at: "2019-12-03T12:05:00Z",
        expires_at: null
      }
    ])

    const emptyResponse = await request(server)
      .get("/requests/GAUS24HFG55JS3XSCGU4A7VRUSZ5LMWTJMBDUPGGOCEFPAWBWRH6WGPU")
      .expect(200)

    t.deepEqual(emptyResponse.body, [])
  }))

test("can fetch requests with cursor parameter", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get("/requests/GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU")
      .query({ cursor: "e51168fe-340b-44d4-a5c1-f0d78c878c4a" })
      .expect(200)

    t.deepEqual(response.body, [
      {
        cursor: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "pending",
        created_at: "2019-12-03T12:00:00Z",
        updated_at: "2019-12-03T12:10:00Z",
        expires_at: null
      },
      {
        cursor: "7974897e-1230-4d12-8588-644c6cfeba23",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        req:
          "web+stellar:tx?xdr=AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA",
        status: "submitted",
        created_at: "2019-12-03T12:05:00Z",
        updated_at: "2019-12-03T12:05:00Z",
        expires_at: null
      }
    ])

    const emptyResponse = await request(server)
      .get("/requests/GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU")
      .query({ cursor: "7974897e-1230-4d12-8588-644c6cfeba23" })
      .expect(200)

    t.deepEqual(emptyResponse.body, [])
  }))

test.todo("can subscribe to signature requests SSE stream")
