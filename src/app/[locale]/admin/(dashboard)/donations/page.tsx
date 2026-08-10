import { desc, sql } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { DonationsTable } from '@/components/admin/donations-table'
import { Card, CardContent } from '@/components/ui/card'
import { db } from '@/db'
import { campaignTranslations, campaigns, donations } from '@/db/schema'
import { defaultLocale, type Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { formatMoney } from '@/lib/money'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminDonationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('donations')

  const [t, tCommon, settings] = await Promise.all([
    getTranslations('admin.donations'),
    getTranslations('admin.dashboard'),
    getSiteSettings(),
  ])

  const [rows, campaignRows, totals] = await Promise.all([
    db
      .select({
        donation: donations,
        campaignTitle: campaignTranslations.title,
      })
      .from(donations)
      .leftJoin(
        campaignTranslations,
        sql`${campaignTranslations.campaignId} = ${donations.campaignId} and ${campaignTranslations.locale} = ${defaultLocale}`,
      )
      .orderBy(desc(donations.createdAt))
      .limit(300),
    db
      .select({ id: campaigns.id, title: campaignTranslations.title })
      .from(campaigns)
      .leftJoin(
        campaignTranslations,
        sql`${campaignTranslations.campaignId} = ${campaigns.id} and ${campaignTranslations.locale} = ${defaultLocale}`,
      ),
    db
      .select({
        succeeded: sql<number>`coalesce(sum(${donations.amountMinor}) filter (where ${donations.status} = 'succeeded'), 0)::bigint`,
        pending: sql<number>`coalesce(sum(${donations.amountMinor}) filter (where ${donations.status} in ('pending','processing')), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(donations)
      .where(sql`true`),
  ])

  const currency = settings.donations.defaultCurrency
  const summary = totals[0]

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('totals.succeeded')}</p>
            <p className="mt-1 font-heading text-heading font-bold">
              {formatMoney(Number(summary?.succeeded ?? 0), currency, locale, { hideDecimals: true })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('totals.pending')}</p>
            <p className="mt-1 font-heading text-heading font-bold">
              {formatMoney(Number(summary?.pending ?? 0), currency, locale, { hideDecimals: true })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('totals.count')}</p>
            <p className="mt-1 font-heading text-heading font-bold">{summary?.count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <DonationsTable
        locale={locale}
        currencies={settings.donations.currencies}
        canExport
        campaigns={campaignRows
          .filter((row) => row.title)
          .map((row) => ({ id: row.id, title: row.title! }))}
        rows={rows.map(({ donation, campaignTitle }) => ({
          id: donation.id,
          reference: donation.reference,
          donor: donation.isAnonymous
            ? t('anonymous')
            : donation.donorOrganisation || donation.donorName || tCommon('noData'),
          email: donation.donorEmail,
          amountMinor: donation.amountMinor,
          currency: donation.currency,
          status: donation.status,
          provider: donation.provider,
          campaign: campaignTitle,
          createdAt: donation.createdAt.toISOString(),
          receiptSent: Boolean(donation.receiptSentAt),
        }))}
      />
    </div>
  )
}
