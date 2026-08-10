import { desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { UsersManager } from '@/components/admin/users-manager'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const current = await requirePermission('users')

  const [t, rows] = await Promise.all([
    getTranslations('admin.users'),
    db.select().from(users).orderBy(desc(users.createdAt)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <UsersManager
        locale={locale}
        currentUserId={current.id}
        rows={rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          locale: row.locale,
          isActive: row.isActive,
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
