import 'server-only'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { db } from '@/db'
import { ngoContacts, partners } from '@/db/schema'
import { env } from '@/env'
import type { Locale } from '@/i18n/config'

/**
 * Sessions for partner contacts, deliberately separate from the admin's.
 *
 * A different cookie, a different audience claim and a different table. An
 * admin session must never be reachable by tampering with a partner token,
 * and the two are read by different code paths so a mistake in one cannot
 * widen the other. The token carries only the contact id; the row is re-read
 * on every request, so revoking access takes effect immediately.
 */

const COOKIE_NAME = 'pw_partner'
const AUDIENCE = 'partner-portal'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14

const secret = new TextEncoder().encode(env.AUTH_SECRET)

export type PartnerSession = {
  contactId: string
  partnerId: string
  partnerName: string
  name: string
  email: string
  locale: Locale
}

export async function createPartnerSession(contactId: string): Promise<void> {
  const token = await new SignJWT({ sub: contactId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret)

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function destroyPartnerSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** Memoised per request; several components on a portal page need it. */
export const getPartnerSession = cache(async (): Promise<PartnerSession | null> => {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    // The audience claim is checked, so an admin token cannot be replayed here
    // and vice versa even though both are signed with the same secret.
    const { payload } = await jwtVerify(token, secret, { audience: AUDIENCE })
    const contactId = payload.sub
    if (!contactId) return null

    const [row] = await db
      .select({ contact: ngoContacts, partnerName: partners.name })
      .from(ngoContacts)
      .innerJoin(partners, eq(partners.id, ngoContacts.partnerId))
      .where(eq(ngoContacts.id, contactId))
      .limit(1)

    if (!row || !row.contact.isActive) return null

    return {
      contactId: row.contact.id,
      partnerId: row.contact.partnerId,
      partnerName: row.partnerName,
      name: row.contact.name,
      email: row.contact.email,
      locale: row.contact.locale,
    }
  } catch {
    return null
  }
})
