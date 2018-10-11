import test from "ava"
import getPort from "get-port"
import { Server } from "http"
import { Pool } from "pg"

import createApp from "../../src/app"
import config, { Config } from "../../src/config"
import { connectToDatabase, database } from "../../src/database"
import { subscribeToChannels } from "../../src/notifications"
import { prepareDatabase } from "./database"

interface App {
  config: Config
  database: Pool
  server: Server
}

test.before(async () => {
  await connectToDatabase()

  subscribeToChannels()
})

export async function withApp(callback: (app: App) => Promise<any>) {
  const port = await getPort()
  const testingConfig: Config = {
    ...config,
    baseUrl: `http://localhost:${port}`,
    port
  }

  await prepareDatabase(database)

  const app = createApp(testingConfig)
  const server = await new Promise<Server>(resolve => {
    const serverInstance = app.listen(testingConfig.port, "127.0.0.1", () =>
      resolve(serverInstance)
    )
  })

  try {
    return await callback({
      config: testingConfig,
      database,
      server
    })
  } finally {
    server.close()
  }
}
