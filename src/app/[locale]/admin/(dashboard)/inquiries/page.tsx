import { desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { InquiriesList } from '@/components/admin/inquiries-list'
import { db } from '@/db'
import { ngoInquiries } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminInquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('inquiries')

  const [t, rows] = await Promise.all([
    getTranslations('admin.inquiries'),
    db.select().from(ngoInquiries).orderBy(desc(ngoInquiries.createdAt)).limit(200),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <InquiriesList
        locale={locale}
        rows={rows.map((row) => ({
          id: row.id,
          organisationName: row.organisationName,
          contactName: row.contactName,
          email: row.email,
          phone: row.phone,
          country: row.country,
          region: row.region,
          interventionType: row.interventionType,
          wellsRequested: row.wellsRequested,
          beneficiariesEstimate: row.beneficiariesEstimate,
          budgetMinor: row.budgetMinor,
          currency: row.currency,
          timeframe: row.timeframe,
          message: row.message,
          status: row.status,
          adminNote: row.adminNote,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
