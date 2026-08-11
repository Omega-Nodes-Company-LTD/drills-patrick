import { desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { LegacyEnquiryList } from '@/components/admin/legacy-enquiry-list'
import { db } from '@/db'
import { legacyEnquiries } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminLegaciesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('inquiries')

  const [t, rows] = await Promise.all([
    getTranslations('admin.nav'),
    db.select().from(legacyEnquiries).orderBy(desc(legacyEnquiries.createdAt)).limit(200),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('legacies')} />
      <LegacyEnquiryList
        rows={rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          name: row.name,
          email: row.email,
          phone: row.phone,
          country: row.country,
          organisation: row.organisation,
          preferredContact: row.preferredContact,
          message: row.message,
          status: row.status,
          adminNote: row.adminNote,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
