import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Applies pending migrations. Run manually with `pnpm db:migrate`; the Docker
 * entrypoint runs the compiled equivalent on every boot.
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  console.log('Applying migrations...')
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  console.log('Migrations applied.')

  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
