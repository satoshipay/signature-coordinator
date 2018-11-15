import Koa from "koa"
import CORS from "kcors"

import { Config } from "./config"
import createRouter from "./router"

export default function createApp(config: Config) {
  const app = new Koa()
  const router = createRouter(config)

  return app
    .use(CORS())
    .use(router.routes())
    .use(router.allowedMethods())
}
