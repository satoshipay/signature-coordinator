import { parse, sanitize } from "envfefe"

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
    hostname: {
      sanitize: sanitize.string
    },
    port: {
      default: 3000,
      sanitize: sanitize.number
    }
  })
}

export default getConfig()
