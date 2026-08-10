import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { db } from '@/db'
import { users, type User, type UserRole } from '@/db/schema'
import { env } from '@/env'

/**
 * Sessions are stateless: a signed JWT in an http-only cookie.
 * The token only carries the user id; the row is re-read on every request so a
 * deactivated account or a role change takes effect immediately.
 */

const COOKIE_NAME = 'pw_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

const secret = new TextEncoder().encode(env.AUTH_SECRET)

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'locale' | 'avatarUrl'>

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
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

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** Memoised per request so several server components can call it freely. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    const userId = payload.sub
    if (!userId) return null

    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!row || !row.isActive) return null

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      locale: row.locale,
      avatarUrl: row.avatarUrl,
    }
  } catch {
    return null
  }
})

// ---------------------------------------------------------------- permissions

export type Permission =
  | 'content'
  | 'media'
  | 'projects'
  | 'donations'
  | 'inquiries'
  | 'appearance'
  | 'settings'
  | 'users'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'content',
    'media',
    'projects',
    'donations',
    'inquiries',
    'appearance',
    'settings',
    'users',
  ],
  editor: ['content', 'media', 'projects', 'inquiries', 'appearance'],
  finance: ['donations', 'inquiries'],
}

export function can(user: Pick<SessionUser, 'role'> | null, permission: Permission): boolean {
  if (!user) return false
  return ROLE_PERMISSIONS[user.role].includes(permission)
}

export function permissionsOf(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role]
}
