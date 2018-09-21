import { Pool, PoolClient } from "pg"
import config from "./config"

export type DBClient = Pool | PoolClient

export const database = new Pool({ connectionString: config.database })
