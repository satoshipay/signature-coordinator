import terminus from "@godaddy/terminus"

import createApp from "./app"
import config from "./config"
import { connectToDatabase } from "./database"
import { selectStellarNetwork } from "./lib/stellar"
import { subscribeToChannels } from "./notifications"

async function launch() {
  await connectToDatabase()
  await selectStellarNetwork(config.horizon)

  subscribeToChannels()
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
