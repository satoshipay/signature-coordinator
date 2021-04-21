import { parse, sanitize } from "envfefe"
import { Keypair, Server } from "stellar-sdk"

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
    serveStellarToml: {
      sanitize: sanitize.boolean
    },
    signingSecretKey: {
      sanitize: sanitize.string
    },
    txMaxTtl: {
      default: "30d",
      sanitize: sanitize.string
    }
  })

  return {
    ...parsedConfig,
    signingKeypair: Keypair.fromSecret(parsedConfig.signingSecretKey)
  }
}

const config = getConfig()

export default config

export const horizonServers = {
  pubnet: new Server(config.horizon),
  testnet: new Server(config.horizonTestnet)
}
