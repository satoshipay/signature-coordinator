import { parseStellarUri } from "@stellarguard/stellar-uri"
import HttpError from "http-errors"
import BodyParser from "koa-body"
import Router from "koa-router"

import config from "./config"
import { collateSignatures } from "./endpoints/collate"
import { handleSignatureRequestSubmission } from "./endpoints/create"
import { querySignatureRequests, serializeSignatureRequestAndSigners } from "./endpoints/query"
import { streamSignatureRequests } from "./endpoints/stream"
import { submitTransaction } from "./endpoints/submit"
import { querySignatureRequestByHash, SerializedSignatureRequest } from "./models/signature-request"
import { database } from "./database"

// tslint:disable-next-line
const pkg = require("../package.json") as any

function urlJoin(baseURL: string, path: string) {
  if (baseURL.charAt(baseURL.length - 1) === "/" && path.charAt(0) === "/") {
    return baseURL + path.substr(1)
  } else if (baseURL.charAt(baseURL.length - 1) === "/" || path.charAt(0) === "/") {
    return baseURL + path
  } else {
    return baseURL + "/" + path
  }
}

const createHRef = (path: string) => urlJoin(config.baseUrl, path)
const router = new Router()

function prepareSignatureRequest(serialized: SerializedSignatureRequest) {
  const uri = parseStellarUri(serialized.req)
  uri.callback = createHRef(`/signatures/collate/${serialized.hash}`)

  return {
    ...serialized,
    req: uri.toString()
  }
}

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

  if (request.accepts("text/event-stream")) {
    streamSignatureRequests(context.req, context.res, accountIDs, prepareSignatureRequest)

    // Don't close the request/stream after handling the route!
    context.respond = false
  } else {
    const serializedSignatureRequests = await querySignatureRequests(accountIDs, { cursor, limit })
    response.body = serializedSignatureRequests.map(prepareSignatureRequest)
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

  response.body = await handleSignatureRequestSubmission(req, signature, pubkey)
})

router.post("/collate/:hash", async ({ params, request, response, throw: fail }) => {
  if (!request.body || typeof request.body !== "object") {
    throw HttpError(400, "Expected application/x-www-form-urlencoded POST body.")
  }

  const {
    pubkey = fail("Request body parameter pubkey not set"),
    signature = fail("Request body parameter signature not set")
  } = request.body

  response.body = await collateSignatures(params.hash, signature, pubkey)
})

router.post("/submit/:hash", async ({ params, response }) => {
  const [submissionResponse, submissionURL] = await submitTransaction(params.hash)

  // TODO: Check size of submission response body

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
