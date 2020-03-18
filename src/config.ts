import { parse, sanitize } from "envfefe"
import { Server } from "stellar-sdk"

export type Config = ReturnType<typeof getConfig>

function getConfig() {
  const parsedConfig = parse({
    baseUrl: {
      sanitize: sanitize.string
    },
    pgdatabase: {
      sanitize: sanitize.string
    },
    pghost: {
      sanitize: sanitize.string
    },
    pgpassword: {
      sanitize: sanitize.string
    },
    pguser: {
      sanitize: sanitize.string
    },
    horizon: {
      sanitize: sanitize.string
    },
    horizonTestnet: {
      sanitize: sanitize.string
    },
    port: {
      default: 3000,
      sanitize: sanitize.number
    },
    txMaxTtl: {
      default: "30d",
      sanitize: sanitize.string
    }
  })

  return parsedConfig
}

const config = getConfig()

export default config

export const horizonServers = {
  pubnet: new Server(config.horizon),
  testnet: new Server(config.horizonTestnet)
}
