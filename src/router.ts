import BodyParser from "koa-body"
import Router from "koa-router"

import { Config } from "./config"
import { querySignatureRequests } from "./endpoints/query-signature-requests"

export default function createRouter(config: Config) {
  const router = new Router()

  router.use(BodyParser())
  router.prefix(config.basePath)

  router.get("/multisig/:accountID", async ({ params, response }) => {
    const { accountID } = params

    response.body = await querySignatureRequests(accountID)
  })

  router.post("/multisig/submit", () => {
    // TODO
  })

  router.post("/multisig/collate/:id", () => {
    // TODO
  })

  router.get("/status/live", ctx => {
    ctx.status = 200
  })

  return router
}
