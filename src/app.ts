import Koa from "koa"
import CORS from "kcors"
import url from "url"

import { Config } from "./config"
import createRouter from "./router"

export default function createApp(config: Config) {
  const app = new Koa()
  const router = createRouter(config)
  const pathPrefix = url.parse(config.baseUrl).pathname as string

  router.prefix(pathPrefix)

  return app
    .use(CORS())
    .use(router.routes())
    .use(router.allowedMethods())
}
