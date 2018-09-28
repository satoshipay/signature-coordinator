import { parse, sanitize } from "envfefe"
import { Server } from "stellar-sdk"

export type Config = ReturnType<typeof getConfig>

function getConfig() {
  return parse({
    basePath: {
      default: "/",
      sanitize: sanitize.string
    },
    database: {
      sanitize: sanitize.string
    },
    horizon: {
      sanitize: sanitize.string
    },
    hostname: {
      sanitize: sanitize.string
    },
    port: {
      default: 3000,
      sanitize: sanitize.number
    }
  })
}

const config = getConfig()

export default config

export const horizon = new Server(config.horizon)
