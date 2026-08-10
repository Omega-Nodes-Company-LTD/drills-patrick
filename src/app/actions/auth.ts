'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, destroySession, getCurrentUser } from '@/lib/auth/session'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { locales } from '@/i18n/config'

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254),
  password: z.string().min(1).max(200),
  locale: z.enum(locales).default('en'),
})

export type SignInResult = { ok: false; error: 'invalid' | 'inactive' | 'too_many' } | { ok: true }

/**
 * Credentials sign-in. Failures are deliberately indistinguishable (wrong
 * address and wrong password both return `invalid`) and are rate limited per
 * IP address.
 */
export async function signIn(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const ip = await clientIdentifier()
  if (!rateLimit(`signin:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 }).ok) {
    return { ok: false, error: 'too_many' }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)

  if (!user) {
    // Constant-ish time: still run a hash comparison against a dummy value.
    await verifyPassword(parsed.data.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidin')
    return { ok: false, error: 'invalid' }
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!valid) return { ok: false, error: 'invalid' }
  if (!user.isActive) return { ok: false, error: 'inactive' }

  await createSession(user.id)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  await recordAudit({
    actor: { id: user.id, email: user.email, name: user.name, role: user.role, locale: user.locale, avatarUrl: user.avatarUrl },
    action: 'sign_in',
    entityType: 'user',
    entityId: user.id,
  })

  redirect(`/${parsed.data.locale}/admin`)
}

export async function signOut(locale: string) {
  const user = await getCurrentUser()
  if (user) {
    await recordAudit({ actor: user, action: 'sign_out', entityType: 'user', entityId: user.id })
  }
  await destroySession()
  redirect(`/${locale}/admin/login`)
}
