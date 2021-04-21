import test from "ava"
import { Asset, Keypair, Networks, Operation, Transaction } from "stellar-sdk"
import request from "supertest"
import { withApp } from "./_helpers/bootstrap"
import { seedSignatureRequests, Pool } from "./_helpers/seed"
import {
  prepareTestnetAccount,
  buildTransaction,
  buildTransactionURI
} from "./_helpers/transactions"

const keypair1 = Keypair.random()
const keypair2 = Keypair.random()

let tx: Transaction

test.before(async () => {
  await prepareTestnetAccount(keypair1, 2, [keypair2.publicKey()])
})

async function seed(database: Pool) {
  tx = await buildTransaction(Networks.TESTNET, keypair1.publicKey(), [
    Operation.payment({
      amount: "10.0",
      asset: Asset.native(),
      destination: keypair2.publicKey()
    })
  ])

  tx.sign(keypair1)

  const req = buildTransactionURI(Networks.TESTNET, tx).toString()

  await seedSignatureRequests(database, [
    {
      request: {
        id: "ae4fb902-f02a-4f3f-b5d1-c9221b7cb40c",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        created_at: new Date("2019-12-03T12:00:00.000Z"),
        updated_at: new Date("2019-12-03T12:10:00.000Z"),
        req,
        status: "pending"
      } as const,
      signatures: []
    },
    {
      request: {
        id: "7974897e-1230-4d12-8588-644c6cfeba23",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        created_at: new Date("2019-12-03T12:05:00.000Z"),
        updated_at: new Date("2019-12-03T12:05:00.000Z"),
        req,
        status: "submitted"
      } as const,
      signatures: [
        {
          signer: keypair1.publicKey(),
          xdr: keypair1.sign(tx.hash()).toString("hex")
        }
      ]
    },
    {
      request: {
        id: "e51168fe-340b-44d4-a5c1-f0d78c878c4a",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        created_at: new Date("2019-12-03T11:00:00.000Z"),
        updated_at: new Date("2019-12-03T11:00:00.000Z"),
        req,
        status: "submitted"
      } as const,
      signatures: [
        {
          signer: keypair1.publicKey(),
          xdr: keypair1.sign(tx.hash()).toString("hex")
        },
        {
          signer: keypair2.publicKey(),
          xdr: keypair2.sign(tx.hash()).toString("hex")
        }
      ]
    }
  ])
}

test("can fetch latest requests", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get(`/accounts/${keypair1.publicKey()}/transactions`)
      .expect(200)

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    t.deepEqual(response.body, [
      {
        cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759",
        req,
        error: null,
        status: "submitted",
        created_at: "2019-12-03T11:00:00.000Z",
        updated_at: "2019-12-03T11:00:00.000Z",
        signed_by: [keypair1.publicKey(), keypair2.publicKey()].sort(),
        signers: [keypair1.publicKey(), keypair2.publicKey()].sort()
      },
      {
        cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        req,
        error: null,
        status: "pending",
        created_at: "2019-12-03T12:00:00.000Z",
        updated_at: "2019-12-03T12:10:00.000Z",
        signed_by: [],
        signers: [keypair1.publicKey(), keypair2.publicKey()].sort()
      },
      {
        cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        req,
        error: null,
        status: "submitted",
        created_at: "2019-12-03T12:05:00.000Z",
        updated_at: "2019-12-03T12:05:00.000Z",
        signed_by: [keypair1.publicKey()],
        signers: [keypair1.publicKey(), keypair2.publicKey()].sort()
      }
    ])

    const emptyResponse = await request(server)
      .get("/accounts/GAUS24HFG55JS3XSCGU4A7VRUSZ5LMWTJMBDUPGGOCEFPAWBWRH6WGPU/transactions")
      .expect(200)

    t.deepEqual(emptyResponse.body, [])
  }))

test("can fetch requests with cursor parameter", t =>
  withApp(async ({ database, server }) => {
    await seed(database)

    const response = await request(server)
      .get(`/accounts/${keypair1.publicKey()}/transactions`)
      .query({ cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110759" })
      .expect(200)

    const req = buildTransactionURI(Networks.TESTNET, tx).toString()

    t.deepEqual(response.body, [
      {
        cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110757",
        req,
        error: null,
        status: "pending",
        created_at: "2019-12-03T12:00:00.000Z",
        updated_at: "2019-12-03T12:10:00.000Z",
        signed_by: [],
        signers: [keypair1.publicKey(), keypair2.publicKey()].sort()
      },
      {
        cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        hash: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758",
        req,
        error: null,
        status: "submitted",
        created_at: "2019-12-03T12:05:00.000Z",
        updated_at: "2019-12-03T12:05:00.000Z",
        signed_by: [keypair1.publicKey()],
        signers: [keypair1.publicKey(), keypair2.publicKey()].sort()
      }
    ])

    const emptyResponse = await request(server)
      .get("/accounts/GD73FQ7GIS4NQOO7PJKJWCKYYX5OV27QNAYJVIRHZPXEEF72VR22MLXU/transactions")
      .query({ cursor: "4038bd405b797086a37fa72c9fef6703cdc87c0da4ff82061b7775938a110758" })
      .expect(200)

    t.deepEqual(emptyResponse.body, [])
  }))

test.todo("can subscribe to signature requests SSE stream")
