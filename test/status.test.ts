import test from "ava"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests, Pool } from "./_helpers/seed"

function seed(database: Pool) {
  return seedSignatureRequests(database, [
    {
      request: {
        id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        created_at: new Date("2019-12-03T12:00:00.000Z").toISOString(),
        updated_at: new Date("2019-12-03T12:10:00.000Z").toISOString(),
        req: `web+stellar:tx?xdr=${encodeURIComponent(
          "AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA"
        )}`,
        status: "pending"
      } as const,
      signatures: []
    },
    {
      request: {
        id: "7974897e-1230-4d12-8588-644c6cfeba23",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        created_at: new Date("2019-12-03T12:00:00.000Z").toISOString(),
        updated_at: new Date("2019-12-03T12:10:00.000Z").toISOString(),
        req: `web+stellar:tx?xdr=${encodeURIComponent(
          "AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA"
        )}`,
        status: "submitted"
      } as const,
      signatures: []
    },
    {
      request: {
        id: "8cd634aa-0bff-4fc4-994f-96ebb85270d5",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        created_at: new Date("2019-12-03T12:00:00.000Z").toISOString(),
        updated_at: new Date("2019-12-03T12:10:00.000Z").toISOString(),
        expires_at: new Date("2019-12-03T12:10:00.000Z").toISOString(),
        req: `web+stellar:tx?xdr=${encodeURIComponent(
          "AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA"
        )}`,
        status: "failed"
      } as const,
      signatures: []
    }
  ])
}

test("can retrieve a pending transaction request's status", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get("/status/4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757")
      .expect(200)

    t.deepEqual(response.body, {
      cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
      hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
      req: `web+stellar:tx?xdr=${encodeURIComponent(
        "AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA"
      )}`,
      error: null,
      signed_by: [],
      status: "pending",
      created_at: "2019-12-03T12:00:00.000Z",
      updated_at: "2019-12-03T12:10:00.000Z"
    })
  }))

test("can retrieve a completed transaction request's status", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get("/status/4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758")
      .expect(200)

    t.deepEqual(response.body, {
      cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
      hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
      req: `web+stellar:tx?xdr=${encodeURIComponent(
        "AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA"
      )}`,
      error: null,
      signed_by: [],
      status: "submitted",
      created_at: "2019-12-03T12:00:00.000Z",
      updated_at: "2019-12-03T12:10:00.000Z"
    })
  }))

test("can retrieve a stale transaction request's status", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get("/status/4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759")
      .expect(200)

    t.deepEqual(response.body, {
      cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
      hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
      req: `web+stellar:tx?xdr=${encodeURIComponent(
        "AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAA/7LD5kS42DnfelSbCVjF+urr8GgwmqIny+5CF/qsdaYAAAAAAAAAAACYloAAAAAAAAAAAA"
      )}`,
      signed_by: [],
      status: "failed",
      error: {
        message: "Transaction is stale"
      },
      created_at: "2019-12-03T12:00:00.000Z",
      updated_at: "2019-12-03T12:10:00.000Z"
    })
  }))
