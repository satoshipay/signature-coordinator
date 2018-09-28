import * as fs from "fs"
import * as path from "path"
import { Pool } from "pg"

const migrationDirPath = path.join(__dirname, "../../migrations")
const migrationFilePaths = fs
  .readdirSync(migrationDirPath)
  .map(fileName => path.join(migrationDirPath, fileName))
const migrations = migrationFilePaths.map(filePath => ({
  content: fs.readFileSync(filePath, "utf8"),
  filePath
}))

export async function prepareDatabase(database: Pool) {
  await database.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
  `)

  for (const migration of migrations) {
    try {
      await database.query(migration.content)
    } catch (error) {
      throw new Error(
        `Database migration failed: ${path.basename(migration.filePath)}\n${error.message}`
      )
    }
  }
}
