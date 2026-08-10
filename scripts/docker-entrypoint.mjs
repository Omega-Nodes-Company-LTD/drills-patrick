import { spawn } from 'node:child_process'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Container entrypoint: apply migrations, then hand over to the Next.js
 * standalone server. Keeping migrations here means a Coolify redeploy always
 * boots with an up-to-date schema.
 */

async function runMigrations() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set — refusing to start.')
    process.exit(1)
  }

  const client = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(client), { migrationsFolder: './src/db/migrations' })
    console.log('[entrypoint] migrations applied')
  } finally {
    await client.end({ timeout: 5 })
  }
}

async function main() {
  if (process.env.SKIP_MIGRATIONS !== '1') {
    await runMigrations()
  }

  const server = spawn('node', ['server.js'], { stdio: 'inherit' })

  const forward = (signal) => () => server.kill(signal)
  process.on('SIGTERM', forward('SIGTERM'))
  process.on('SIGINT', forward('SIGINT'))

  server.on('exit', (code) => process.exit(code ?? 0))
}

main().catch((error) => {
  console.error('[entrypoint] startup failed:', error)
  process.exit(1)
})
