import createError from "http-errors"
import BodyParser from "koa-body"
import Router from "koa-router"

import { Config } from "./config"
import { collateSignatures } from "./endpoints/collate-signatures"
import { querySignatureRequests } from "./endpoints/query-signature-requests"
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

  router.get("/requests/:accountID", async ({ params, query, response }) => {
    const { accountID } = params
    const cursor = query.cursor ? Number.parseInt(query.cursor, 10) : undefined
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined

    const requests = await querySignatureRequests(accountID, { cursor, limit })

    const preparedRequests = requests.map(request => {
      const collateURL = createHRef(`/signatures/collate/${request.id}`)
      return {
        ...request,
        request_uri: patchSignatureRequestURIParameters(request.request_uri, {
          callback: `url:${collateURL}`
        })
      }
    })

    response.body = preparedRequests
  })

  router.post("/submit", async ({ request, response }) => {
    if (typeof request.body !== "string") {
      throw createError(400, "Expected URL-formatted payment request as POST request body.")
    }

    response.body = await handleSignatureRequestSubmission(request.body)
  })

  router.post("/signatures/collate/:id", async ({ params, request, response }) => {
    if (!request.body || typeof request.body !== "object") {
      throw createError(400, "Expected application/x-www-form-urlencoded POST body.")
    }

    const signatureRequestID = params.id
    const { xdr } = request.body

    response.body = await collateSignatures(signatureRequestID, xdr)
  })

  router.get("/status/live", ctx => {
    ctx.status = 200
  })

  return router
}
