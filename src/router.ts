import Router from "koa-router"

import { Config } from "./config"

export default function createRouter(config: Config) {
  const router = new Router()

  router.prefix(config.basePath)

  router.get("/status/live", function(ctx) {
    ctx.status = 200
  })

  return router
}
