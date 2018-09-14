import errorResponse from "@satoshipay/koa-error-response"
import Koa from "koa"

import { Config } from "./config"
import createRouter from "./router"

export default function createApp(config: Config) {
  const app = new Koa()
  const router = createRouter(config)

  return app
    .use(errorResponse())
    .use(router.routes())
    .use(router.allowedMethods())
}
