import { getTranslations, setRequestLocale } from 'next-intl/server'
import { desc } from 'drizzle-orm'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { GivingManager } from '@/components/admin/giving-manager'
import { db } from '@/db'
import { matchingPledges, recurringPlans } from '@/db/schema'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminCampaignOptions, adminProjectOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { adminListAdoptions } from '@/lib/giving/adoptions'
import { invoicingReady } from '@/lib/giving/invoicing'
import { adminListInvoices, adminListSponsors, uninvoicedCorporateGifts } from '@/lib/giving/invoices'
import { fromMinorUnits } from '@/lib/money'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminGivingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('donations')

  const [t, settings, pledges, sponsors, invoices, uninvoiced, adoptions, plans, projects, campaigns] =
    await Promise.all([
      getTranslations('admin.nav'),
      getSiteSettings(),
      db.select().from(matchingPledges).orderBy(desc(matchingPledges.startsAt)).limit(100),
      adminListSponsors(),
      adminListInvoices(),
      uninvoicedCorporateGifts(),
      adminListAdoptions(),
      db.select().from(recurringPlans).orderBy(desc(recurringPlans.createdAt)).limit(200),
      adminProjectOptions(),
      adminCampaignOptions(),
    ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('giving')} />
      <GivingManager
        locale={locale}
        invoicingReady={invoicingReady(settings.invoicing)}
        storageEnabled={features.storage}
        options={{
          projects,
          campaigns,
          currencies: settings.donations.currencies,
          defaultCurrency: settings.donations.defaultCurrency,
        }}
        pledges={pledges.map((row) => ({
          id: row.id,
          campaignId: row.campaignId,
          matcherName: row.matcherName,
          matcherLogoId: row.matcherLogoId,
          matcherUrl: row.matcherUrl,
          ratioBp: row.ratioBp,
          ceiling: String(fromMinorUnits(row.ceilingMinor, row.currency)),
          ceilingMinor: row.ceilingMinor,
          perDonationCap:
            row.perDonationCapMinor != null
              ? String(fromMinorUnits(row.perDonationCapMinor, row.currency))
              : '',
          matchedMinor: row.matchedMinor,
          currency: row.currency,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          isActive: row.isActive,
          note: row.note,
        }))}
        sponsors={sponsors.map((row) => ({
          id: row.id,
          name: row.name,
          logoId: row.logoId,
          websiteUrl: row.websiteUrl,
          projectId: row.projectId,
          campaignId: row.campaignId,
          tier: row.tier,
          legalName: row.legalName,
          vatNumber: row.vatNumber,
          country: row.country,
          isPublished: row.isPublished,
          sortOrder: row.sortOrder,
        }))}
        invoices={invoices.map((row) => ({
          id: row.id,
          number: row.number,
          issuedOn: row.issuedOn,
          billToName: row.billToName,
          netMinor: row.netMinor,
          taxMinor: row.taxMinor,
          grossMinor: row.grossMinor,
          taxRateBp: row.taxRateBp,
          currency: row.currency,
          voidedAt: row.voidedAt?.toISOString() ?? null,
        }))}
        uninvoiced={uninvoiced.map((row) => ({
          id: row.id,
          reference: row.reference,
          organisation: row.donorOrganisation ?? row.donorName ?? '—',
          email: row.donorEmail,
          country: row.donorCountry,
          amount: String(fromMinorUnits(row.amountMinor, row.currency)),
          amountMinor: row.amountMinor,
          currency: row.currency,
        }))}
        adoptions={adoptions.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          donorName: row.donorName,
          donorEmail: row.donorEmail,
          donorOrganisation: row.donorOrganisation,
          startedOn: row.startedOn,
          endsOn: row.endsOn,
          amount: String(fromMinorUnits(row.amountMinor, row.currency)),
          currency: row.currency,
          updateEveryMonths: row.updateEveryMonths,
          lastUpdateSentAt: row.lastUpdateSentAt?.toISOString() ?? null,
          isPublic: row.isPublic,
          isActive: row.isActive,
        }))}
        plans={plans.map((row) => ({
          id: row.id,
          reference: row.reference,
          donorName: row.donorName,
          donorEmail: row.donorEmail,
          amountMinor: row.amountMinor,
          currency: row.currency,
          interval: row.interval,
          status: row.status,
          nextChargeOn: row.nextChargeOn,
        }))}
      />
    </div>
  )
}
