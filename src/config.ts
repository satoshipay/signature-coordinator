import { parse, sanitize } from "envfefe"
import { Server } from "stellar-sdk"
import { URL } from "url"

export type Config = ReturnType<typeof getConfig>

function setPasswordInURL(urlString: string, password: string) {
  const parsedDatabaseURL = new URL(urlString)
  parsedDatabaseURL.password = password
  return parsedDatabaseURL.toString()
}

function getConfig() {
  const parsedConfig = parse({
    baseUrl: {
      sanitize: sanitize.string
    },
    database: {
      optional: true,
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

  if (!parsedConfig.database && !process.env.PGHOST) {
    throw Error("Neither DATABASE nor PG* environment vars have been set.")
  }
  if (parsedConfig.database && process.env.DATABASE_PASSWORD) {
    parsedConfig.database = setPasswordInURL(parsedConfig.database, process.env.DATABASE_PASSWORD)
  }

  return parsedConfig
}

const config = getConfig()

export default config

export const horizonServers = {
  mainnet: new Server(config.horizon),
  testnet: new Server(config.horizonTestnet)
}
