import { asc, desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { TransparencyManager } from '@/components/admin/transparency-manager'
import { db } from '@/db'
import {
  impactIndicatorTranslations,
  impactIndicators,
  spendingEntries,
  spendingEntryTranslations,
} from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { fromMinorUnits } from '@/lib/money'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminTransparencyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('settings')

  const [t, settings, indicators, indicatorTranslations, spending, spendingTranslations] =
    await Promise.all([
      getTranslations('admin.transparency'),
      getSiteSettings(),
      db.select().from(impactIndicators).orderBy(asc(impactIndicators.sortOrder)),
      db.select().from(impactIndicatorTranslations),
      db
        .select()
        .from(spendingEntries)
        .orderBy(desc(spendingEntries.year), asc(spendingEntries.sortOrder)),
      db.select().from(spendingEntryTranslations),
    ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <TransparencyManager
        locale={locale}
        enabledLocales={settings.enabledLocales}
        indicators={indicators.map((row) => ({
          id: row.id,
          key: row.key,
          value: row.value,
          unit: row.unit,
          methodology: row.methodology,
          source: row.source,
          verifiedOn: row.verifiedOn,
          sortOrder: row.sortOrder,
          translations: Object.fromEntries(
            indicatorTranslations
              .filter((entry) => entry.indicatorId === row.id)
              .map((entry) => [
                entry.locale,
                { label: entry.label, methodology: entry.methodology ?? '' },
              ]),
          ),
        }))}
        spending={spending.map((row) => ({
          id: row.id,
          year: row.year,
          category: row.category,
          amount: String(fromMinorUnits(row.amountMinor, row.currency)),
          amountMinor: row.amountMinor,
          currency: row.currency,
          note: row.note,
          sortOrder: row.sortOrder,
          translations: Object.fromEntries(
            spendingTranslations
              .filter((entry) => entry.entryId === row.id)
              .map((entry) => [entry.locale, { label: entry.label }]),
          ),
        }))}
      />
    </div>
  )
}
