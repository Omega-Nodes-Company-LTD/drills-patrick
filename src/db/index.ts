import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/env'
import * as schema from './schema'

/**
 * Single pooled connection reused across hot reloads in development so that
 * `next dev` does not exhaust Postgres connections.
 */
const globalForDb = globalThis as unknown as {
  __pozziSql?: ReturnType<typeof postgres>
}

const client =
  globalForDb.__pozziSql ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === 'production' ? 10 : 4,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  })

if (env.NODE_ENV !== 'production') {
  globalForDb.__pozziSql = client
}

export const db = drizzle(client, { schema, casing: 'snake_case' })
export const sqlClient = client
export { schema }
export type Database = typeof db
