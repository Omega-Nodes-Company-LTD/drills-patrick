'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { ngoContacts } from '@/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import {
  createPartnerSession,
  destroyPartnerSession,
  getPartnerSession,
} from '@/lib/auth/partner-session'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'

/** Sign-in for partner contacts. Separate from the admin's in every respect. */

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
})

export type PartnerSignInResult = { ok: true } | { ok: false; error: string }

/** Hash of nothing in particular, compared against so a miss costs the same. */
const DUMMY_HASH = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidin'

export async function partnerSignIn(
  _prev: PartnerSignInResult | null,
  formData: FormData,
): Promise<PartnerSignInResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const ip = await clientIdentifier()
  if (!rateLimit(`partner-signin:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 }).ok) {
    return { ok: false, error: 'too_many' }
  }

  const [contact] = await db
    .select()
    .from(ngoContacts)
    .where(eq(ngoContacts.email, parsed.data.email))
    .limit(1)

  if (!contact) {
    // An unknown address must not answer faster than a wrong password.
    await verifyPassword(parsed.data.password, DUMMY_HASH)
    return { ok: false, error: 'invalid' }
  }

  if (!(await verifyPassword(parsed.data.password, contact.passwordHash))) {
    return { ok: false, error: 'invalid' }
  }

  if (!contact.isActive) return { ok: false, error: 'inactive' }

  await createPartnerSession(contact.id)
  await db
    .update(ngoContacts)
    .set({ lastLoginAt: new Date() })
    .where(eq(ngoContacts.id, contact.id))

  return { ok: true }
}

export async function partnerSignOut(locale: Locale): Promise<void> {
  await destroyPartnerSession()
  redirect({ href: '/portal/login', locale })
}

/** Guard for the portal pages: returns the session or sends them to log in. */
export async function requirePartner(locale: Locale) {
  const session = await getPartnerSession()
  if (!session) redirect({ href: '/portal/login', locale })
  return session!
}
