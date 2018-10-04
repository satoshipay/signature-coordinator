import createError from "http-errors"
import BodyParser from "koa-body"
import Router from "koa-router"

import { Config } from "./config"
import { querySignatureRequests } from "./endpoints/query-signature-requests"
import { handleSignatureRequestSubmission } from "./endpoints/submit-signature-request"

export default function createRouter(config: Config) {
  const router = new Router()

  router.use(
    BodyParser({
      urlencoded: true
    })
  )

  router.prefix(config.basePath)

  router.get("/requests/:accountID", async ({ params, query, response }) => {
    const { accountID } = params
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) : undefined
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined

    response.body = await querySignatureRequests(accountID, { offset, limit })
  })

  router.post("/submit", async ({ request, response }) => {
    if (typeof request.body !== "string") {
      throw createError(400, "Expected URL-formatted payment request as POST request body.")
    }

    response.body = await handleSignatureRequestSubmission(request.body)
  })

  router.post("/signatures/collate/:id", () => {
    // TODO
  })

  router.get("/status/live", ctx => {
    ctx.status = 200
  })

  return router
}
