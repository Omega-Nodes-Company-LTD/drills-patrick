import { desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { QuotesManager } from '@/components/admin/quotes-manager'
import { db } from '@/db'
import { drillingRates, quotes } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminQuotesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, rates, issued] = await Promise.all([
    getTranslations('admin.quotes'),
    db.select().from(drillingRates).orderBy(drillingRates.sortOrder, drillingRates.depthFromM),
    db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(50),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <QuotesManager
        locale={locale}
        rates={rates}
        quotes={issued.map((quote) => ({
          id: quote.id,
          reference: quote.reference,
          organisationName: quote.organisationName,
          depthM: quote.depthM,
          wellsCount: quote.wellsCount,
          totalMinor: quote.totalMinor,
          currency: quote.currency,
          status: quote.status,
          createdAt: quote.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
