import { Pool, PoolClient, types as pgTypes } from "pg"
import createPostgresSubscriber from "pg-listen"
import { URL } from "url"
import config from "./config"
import { querySignatureRequestByHash } from "./models/signature-request"

export type DBClient = Pool | PoolClient

export const database = new Pool({ connectionString: config.database })

export const notificationsSubscription = createPostgresSubscriber({
  connectionString: config.database
})

notificationsSubscription.events.on("error", (error: Error) => {
  console.error("Fatal postgres notification subscription error:", error)
  process.exit(1)
})

const TIMESTAMP_OID = 1114

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Parse timestamps as UTC timestamps
pgTypes.setTypeParser(TIMESTAMP_OID, (value: string | null) => {
  return value === null ? null : new Date(value + " UTC")
})

export async function connectToDatabase() {
  try {
    console.log("Checking database connection...")
    await Promise.all([database.connect(), notificationsSubscription.connect()])
    await Promise.race([
      querySignatureRequestByHash(database, "nonexistent"),
      delay(2000).then(() => {
        throw new Error("Database connection test query timed out.")
      })
    ])
    console.log("Database connection ok.")
  } catch (error) {
    const url = new URL(config.database)
    url.password = "*".repeat(url.password.length)
    throw new Error(`Cannot connect to database ${url.toString()}: ${error.message}`)
  }
}

/**
 * @example
 * ```ts
 * await allocateClient(database, async client => {
 *   await client.query('SELECT * FROM foo')
 * })
 * ```
 */
async function allocateClient<ReturnType>(
  callback: (dbClient: PoolClient) => Promise<ReturnType>
): Promise<ReturnType> {
  const dbClient = await database.connect()

  try {
    return await callback(dbClient)
  } finally {
    dbClient.release()
  }
}

/**
 * @example
 * ```ts
 * await transaction(database, async client => {
 *   await client.query('INSERT INTO foo (bar) VALUES ($1)', ['baz'])
 * })
 * ```
 */
export async function transaction<ReturnType>(
  callback: (dbClient: PoolClient) => Promise<ReturnType>
): Promise<ReturnType> {
  return allocateClient(async dbClient => {
    try {
      await dbClient.query("BEGIN")
      const result = await callback(dbClient)
      await dbClient.query("COMMIT")
      return result
    } catch (error) {
      await dbClient.query("ROLLBACK")
      throw error
    }
  })
}
