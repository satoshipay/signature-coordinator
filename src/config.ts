import { parse, sanitize } from "envfefe"
import { Server } from "stellar-sdk"

export type Config = ReturnType<typeof getConfig>

function getConfig() {
  return parse({
    baseUrl: {
      sanitize: sanitize.string
    },
    database: {
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
    }
  })
}

const config = getConfig()

export default config

export const horizonServers = {
  mainnet: new Server(config.horizon),
  testnet: new Server(config.horizonTestnet)
}
