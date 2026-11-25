import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { serverEnv } from '@/lib/env'
import * as schema from './schema'

type Database = PostgresJsDatabase<typeof schema>

// Reuse the underlying TCP connection pool across hot reloads in development,
// but keep the Drizzle wrapper module-scoped so its snake_case CasingCache
// refreshes whenever `schema.ts` hot-reloads with new columns.
const globalForDb = globalThis as unknown as { __galSql?: postgres.Sql }

let cachedDb: Database | undefined
let cachedAssetsRef: unknown

function getSqlClient(): postgres.Sql {
  if (!globalForDb.__galSql) {
    globalForDb.__galSql = postgres(serverEnv().DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: {
        application_name: 'global-asset-ledger',
        // Protect the pool from runaway queries on very large tables.
        statement_timeout: 15_000,
        'pg_trgm.word_similarity_threshold': 0.25,
      },
    })
  }
  return globalForDb.__galSql
}

/** Lazily-initialised Drizzle client (server only). */
export function db(): Database {
  if (!cachedDb || cachedAssetsRef !== schema.assets) {
    cachedDb = drizzle(getSqlClient(), { schema, casing: 'snake_case' })
    cachedAssetsRef = schema.assets
  }
  return cachedDb
}

export { schema }
