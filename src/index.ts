import terminus from "@godaddy/terminus"

import createApp from "./app"
import config from "./config"
import { database } from "./database"
import { selectStellarNetwork } from "./lib/stellar"

async function checkDatabaseConnection() {
  try {
    await database.connect()
  } catch (error) {
    throw new Error(`Cannot connect to database ${config.database}: ${error.message}`)
  }
}

async function launch() {
  await checkDatabaseConnection()
  await selectStellarNetwork(config.horizon)

  const app = createApp(config)

  const server = app.listen(config.port, function(error?: Error) {
    if (error) {
      console.error("Startup error", error)
      process.exit(1)
    } else {
      console.info(`Listening on port ${config.port}`)
    }
  })
  return server
}

launch()
  .then(server => {
    terminus(server, {
      signals: ["SIGINT", "SIGTERM"],
      timeout: 10000,
      onShutdown: async () => {
        console.info("Shutting down...")
        process.exit(0)
      }
    })
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
