import HttpError from "http-errors"
import BodyParser from "koa-body"
import Router from "koa-router"

import config from "./config"
import { database } from "./database"
import { collateSignatures } from "./endpoints/collate"
import { handleSignatureRequestSubmission } from "./endpoints/create"
import { querySignatureRequests, serializeSignatureRequestAndSigners } from "./endpoints/query"
import { streamSignatureRequests } from "./endpoints/stream"
import { submitTransaction } from "./endpoints/submit"
import { querySignatureRequestByHash } from "./models/signature-request"

// tslint:disable-next-line
const pkg = require("../package.json") as any

const router = new Router()

router.use(
  BodyParser({
    urlencoded: true
  })
)

router.get("/", async ({ response }) => {
  response.body = {
    name: pkg.name,
    version: pkg.version,
    capabilities: ["transactions"]
  }
})

router.get("/accounts/:accountIDs/transactions", async context => {
  const { params, query, response, request } = context

  const accountIDs = params.accountIDs.split(",")
  const cursor = query.cursor || undefined
  const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined

  if (request.get("Accept") && /text\/event-stream/.test(request.get("Accept"))) {
    streamSignatureRequests(context.req, context.res, accountIDs)

    // Don't close the request/stream after handling the route!
    context.respond = false
  } else {
    const serializedSignatureRequests = await querySignatureRequests(accountIDs, { cursor, limit })
    response.body = serializedSignatureRequests
  }
})

router.get("/transactions/:hash", async ({ params, response }) => {
  const signatureRequest = await querySignatureRequestByHash(database, params.hash)

  if (!signatureRequest) {
    throw HttpError(404, `Signature request not found`)
  }

  response.body = await serializeSignatureRequestAndSigners(signatureRequest)
})

router.post("/transactions", async ({ request, response }) => {
  if (!request.body || typeof request.body !== "object") {
    throw HttpError(400, "Expected URL-formatted payment request as POST request body.")
  }

  const { pubkey, req, signature } = request.body

  if (!req) {
    throw HttpError(400, `Missing POST parameter "req"`)
  }
  if (!pubkey) {
    throw HttpError(400, `Missing POST parameter "pubkey"`)
  }
  if (!signature) {
    throw HttpError(400, `Missing POST parameter "signature"`)
  }

  const signatureRequest = await handleSignatureRequestSubmission(req, signature, pubkey)
  const transactionUrl = String(new URL(`/status/${signatureRequest.hash}`, config.baseUrl))

  response.body = {
    transactionUrl
  }
})

router.post(
  "/transactions/:hash/signatures",
  async ({ params, request, response, throw: fail }) => {
    if (!request.body || typeof request.body !== "object") {
      throw HttpError(400, "Expected application/x-www-form-urlencoded POST body.")
    }

    const { xdr = fail(`Request body parameter "xdr" not set`) } = request.body

    response.body = await collateSignatures(params.hash, xdr)
  }
)

router.post("/transactions/:hash/submit", async ({ params, response }) => {
  const [submissionResponse, submissionURL] = await submitTransaction(params.hash)

  response.set("X-Submitted-To", submissionURL)
  response.status = submissionResponse.status
  response.body = submissionResponse.data
})

router.get("/status/live", ctx => {
  ctx.status = 200
})

export default router
