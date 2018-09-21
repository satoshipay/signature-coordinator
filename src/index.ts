import terminus from "@godaddy/terminus"
import createApp from "./app"
import config from "./config"
import { database } from "./database"

async function checkDatabaseConnection() {
  try {
    await database.query("SELECT true")
  } catch (error) {
    throw new Error(`Cannot connect to database ${config.database}: ${error.message}`)
  }
}

const app = createApp(config)

const server = app.listen(config.port, function(error?: Error) {
  if (error) {
    console.error("Startup error", error)
    process.exit(1)
  } else {
    console.info(`Listening on port ${config.port}`)
  }
})

checkDatabaseConnection().catch(error => {
  console.error(error)
  process.exit(1)
})

terminus(server, {
  signals: ["SIGINT", "SIGTERM"],
  timeout: 10000,
  onShutdown: async () => {
    console.info("Shutting down...")
    process.exit(0)
  }
})
