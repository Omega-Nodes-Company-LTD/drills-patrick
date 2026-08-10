import { desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { MessagesPanel } from '@/components/admin/messages-panel'
import { db } from '@/db'
import { contactSubmissions, newsletterSubscribers } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('inquiries')

  const [t, contacts, subscribers] = await Promise.all([
    getTranslations('admin.messages'),
    db
      .select()
      .from(contactSubmissions)
      .orderBy(desc(contactSubmissions.createdAt))
      .limit(200),
    db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(500),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <MessagesPanel
        locale={locale}
        contacts={contacts.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          subject: row.subject,
          message: row.message,
          locale: row.locale,
          isHandled: row.isHandled,
          createdAt: row.createdAt.toISOString(),
        }))}
        subscribers={subscribers.map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name,
          locale: row.locale,
          isConfirmed: row.isConfirmed,
          unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
