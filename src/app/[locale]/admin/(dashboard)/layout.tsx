import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import type { Locale } from '@/i18n/config'
import { signOut } from '@/app/actions/auth'
import { requireUser } from '@/lib/auth/guard'
import { permissionsOf } from '@/lib/auth/session'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const user = await requireUser()
  const settings = await getSiteSettings()

  async function handleSignOut() {
    'use server'
    await signOut(locale)
  }

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, role: user.role }}
      permissions={permissionsOf(user.role)}
      siteName={settings.siteName}
      signOutAction={handleSignOut}
    >
      {children}
    </AdminShell>
  )
}
