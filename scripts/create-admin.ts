/* eslint-disable no-console */
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import * as schema from '../src/db/schema'

/**
 * Creates or resets an administrator account.
 *
 *   pnpm create-admin                       # interactive
 *   pnpm create-admin you@example.com secret
 */

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

const client = postgres(url, { max: 1 })
const db = drizzle(client, { schema, casing: 'snake_case' })

function issues(password: string): string[] {
  const list: string[] = []
  if (password.length < 10) list.push('at least 10 characters')
  if (!/[a-z]/.test(password)) list.push('a lowercase letter')
  if (!/[A-Z]/.test(password)) list.push('an uppercase letter')
  if (!/[0-9]/.test(password)) list.push('a digit')
  return list
}

async function main() {
  let [, , email, password, name] = process.argv

  if (!email || !password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    email ??= await rl.question('Email: ')
    password ??= await rl.question('Password: ')
    name ??= await rl.question('Name (optional): ')
    rl.close()
  }

  const problems = issues(password!)
  if (problems.length > 0) {
    console.error(`Password needs ${problems.join(', ')}.`)
    process.exitCode = 1
    return
  }

  const passwordHash = await bcrypt.hash(password!, 12)
  const normalised = email!.trim().toLowerCase()

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalised))
    .limit(1)

  if (existing) {
    await db
      .update(schema.users)
      .set({ passwordHash, role: 'admin', isActive: true })
      .where(eq(schema.users.id, existing.id))
    console.log(`Updated ${normalised}: password reset, role set to admin.`)
  } else {
    await db.insert(schema.users).values({
      email: normalised,
      passwordHash,
      name: name?.trim() || 'Administrator',
      role: 'admin',
    })
    console.log(`Created administrator ${normalised}.`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => client.end())
