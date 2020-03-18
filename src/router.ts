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

router.get("/status/:hash", async ({ params, response }) => {
  const signatureRequest = await querySignatureRequestByHash(database, params.hash)

  if (!signatureRequest) {
    throw HttpError(404, `Signature request not found`)
  }

  response.body = await serializeSignatureRequestAndSigners(signatureRequest)
})

router.get("/requests/:accountIDs", async context => {
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

router.post("/create", async ({ request, response }) => {
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

  response.status = 201
  response.set("Location", String(new URL(`/status/${signatureRequest.hash}`, config.baseUrl)))
})

router.post("/collate/:hash", async ({ params, request, response, throw: fail }) => {
  if (!request.body || typeof request.body !== "object") {
    throw HttpError(400, "Expected application/x-www-form-urlencoded POST body.")
  }

  const {
    pubkey = fail(`Request body parameter "pubkey" not set`),
    signature = fail(`Request body parameter "signature" not set`)
  } = request.body

  response.body = await collateSignatures(params.hash, signature, pubkey)
})

router.post("/submit/:hash", async ({ params, response }) => {
  const [submissionResponse, submissionURL] = await submitTransaction(params.hash)

  response.set("X-Submitted-To", submissionURL)
  response.status = submissionResponse.status
  response.body = submissionResponse.data
})

router.get("/status/live", ctx => {
  ctx.status = 200
})

router.get("/", ctx => {
  ctx.body = {
    name: pkg.name,
    version: pkg.version
  }
})

export default router
