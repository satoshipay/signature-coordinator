import { Pool, PoolClient } from "pg"
import config from "./config"

export type DBClient = Pool | PoolClient

export const database = new Pool({ connectionString: config.database })

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
