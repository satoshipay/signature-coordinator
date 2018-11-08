import createError from "http-errors"
import { createEventStream } from "http-event-stream"
import BodyParser from "koa-body"
import Router from "koa-router"

import { Config } from "./config"
import { collateSignatures } from "./endpoints/collate-signatures"
import { querySignatureRequests } from "./endpoints/query-signature-requests"
import { streamSignatureRequests } from "./endpoints/stream-signature-requests"
import { handleSignatureRequestSubmission } from "./endpoints/submit-signature-request"
import { patchSignatureRequestURIParameters } from "./lib/sep-0007"

function urlJoin(baseURL: string, path: string) {
  if (baseURL.charAt(baseURL.length - 1) === "/" && path.charAt(0) === "/") {
    return baseURL + path.substr(1)
  } else if (baseURL.charAt(baseURL.length - 1) === "/" || path.charAt(0) === "/") {
    return baseURL + path
  } else {
    return baseURL + "/" + path
  }
}

export default function createRouter(config: Config) {
  const createHRef = (path: string) => urlJoin(config.baseUrl, path)
  const router = new Router()

  router.use(
    BodyParser({
      urlencoded: true
    })
  )

  router.get("/requests/:accountIDs", async ({ params, query, response }) => {
    const accountIDs = params.accountIDs.split(",")
    const cursor = query.cursor ? Number.parseInt(query.cursor, 10) : undefined
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined

    const serializedSignatureRequests = await querySignatureRequests(accountIDs, { cursor, limit })

    response.body = serializedSignatureRequests.map(serialized => {
      const collateURL = createHRef(`/signatures/collate/${serialized.hash}`)
      return {
        ...serialized,
        request_uri: patchSignatureRequestURIParameters(serialized.request_uri, {
          callback: `url:${collateURL}`
        })
      }
    })
  })

  router.post("/submit", async ({ request, response }) => {
    if (typeof request.body !== "string") {
      throw createError(400, "Expected URL-formatted payment request as POST request body.")
    }

    response.body = await handleSignatureRequestSubmission(request.body)
  })

  router.post("/signatures/collate/:hash", async ({ params, request, response }) => {
    if (!request.body || typeof request.body !== "object") {
      throw createError(400, "Expected application/x-www-form-urlencoded POST body.")
    }

    const { xdr } = request.body
    response.body = await collateSignatures(params.hash, xdr)
  })

  router.get("/stream/:accountIDs", async context => {
    const accountIDs = context.params.accountIDs.split(",") as string[]
    const eventStream = createEventStream(context.res)

    streamSignatureRequests(eventStream, accountIDs, context.request.get("Last-Event-ID"))

    // Don't close the request/stream after handling the route!
    context.respond = false
  })

  router.get("/status/live", ctx => {
    ctx.status = 200
  })

  return router
}
