#!/usr/bin/env node

import { migrateDatabase } from "./database"

migrateDatabase().then(
  migrations => {
    const names = migrations.map(migration => migration.name)
    console.log(
      `Applied ${migrations.length} migrations: ${names.map(name => `\n  - ${name}`).join("")}`
    )
  },
  error => {
    console.error(error)
    process.exit(1)
  }
)
