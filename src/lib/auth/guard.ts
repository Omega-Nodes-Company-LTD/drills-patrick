import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { can, getCurrentUser, type Permission, type SessionUser } from './session'

/** Redirects to the login page when there is no active session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    const locale = await getLocale()
    redirect(`/${locale}/admin/login`)
  }
  return user
}

/**
 * Redirects to the admin dashboard when the signed-in user lacks a permission,
 * so a `finance` account cannot reach the content editor by typing a URL.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user, permission)) {
    const locale = await getLocale()
    redirect(`/${locale}/admin?denied=${permission}`)
  }
  return user
}

/** For route handlers, where redirecting is not appropriate. */
export async function requireApiUser(permission?: Permission): Promise<SessionUser | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (permission && !can(user, permission)) return null
  return user
}
