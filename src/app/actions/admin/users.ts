'use server'

import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { locales } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { hashPassword, passwordIssues } from '@/lib/auth/password'
import type { ActionResult } from '@/lib/validation/public'

const userSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().min(5).max(254),
  role: z.enum(['admin', 'editor', 'finance']),
  locale: z.enum(locales).default('en'),
  isActive: z.boolean().default(true),
  password: z.string().max(200).optional(),
})

/** At least one active administrator must remain at all times. */
async function otherActiveAdmins(excludeId?: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      excludeId
        ? and(eq(users.role, 'admin'), eq(users.isActive, true), ne(users.id, excludeId))
        : and(eq(users.role, 'admin'), eq(users.isActive, true)),
    )

  return row?.count ?? 0
}

export async function saveUser(input: unknown): Promise<ActionResult> {
  const actor = await requireApiUser('users')
  if (!actor) return { ok: false, error: 'unauthorised' }

  const parsed = userSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data

  if (!data.id && !data.password) return { ok: false, error: 'password_required' }

  if (data.password) {
    const issues = passwordIssues(data.password)
    if (issues.length > 0) {
      return { ok: false, error: 'weak_password', fieldErrors: { password: issues.join(', ') } }
    }
  }

  // Guard against locking everyone out.
  if (data.id && (data.role !== 'admin' || !data.isActive)) {
    if ((await otherActiveAdmins(data.id)) === 0) {
      return { ok: false, error: 'last_admin' }
    }
  }

  const values = {
    name: data.name,
    email: data.email,
    role: data.role,
    locale: data.locale,
    isActive: data.isActive,
    ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
  }

  try {
    if (data.id) {
      await db.update(users).set(values).where(eq(users.id, data.id))
    } else {
      await db.insert(users).values({ ...values, passwordHash: values.passwordHash! })
    }
  } catch (error) {
    // Unique violation on the email column.
    if (error instanceof Error && error.message.includes('users_email_unique')) {
      return { ok: false, error: 'email_taken' }
    }
    throw error
  }

  await recordAudit({
    actor,
    action: data.id ? 'user.update' : 'user.create',
    entityType: 'user',
    entityId: data.id,
    summary: data.email,
  })

  revalidatePath('/[locale]/admin/users', 'page')
  return { ok: true }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const actor = await requireApiUser('users')
  if (!actor) return { ok: false, error: 'unauthorised' }
  if (actor.id === id) return { ok: false, error: 'self' }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!target) return { ok: false, error: 'not_found' }

  if (target.role === 'admin' && (await otherActiveAdmins(id)) === 0) {
    return { ok: false, error: 'last_admin' }
  }

  await db.delete(users).where(eq(users.id, id))

  await recordAudit({
    actor,
    action: 'user.delete',
    entityType: 'user',
    entityId: id,
    summary: target.email,
  })

  revalidatePath('/[locale]/admin/users', 'page')
  return { ok: true }
}
