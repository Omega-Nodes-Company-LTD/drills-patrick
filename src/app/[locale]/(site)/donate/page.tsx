import type { Metadata } from 'next'
import { staticAlternates } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DonationForm } from '@/components/donate/donation-form'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { listCampaigns } from '@/lib/content/queries'
import { listAvailableProviders } from '@/lib/payments/registry'
import { getSiteSettings } from '@/lib/settings/service'
import { sanitizeHtml } from '@/lib/sanitize'
import { pickI18n } from '@/i18n/config'

// Rendered per request: the content lives in the database, so the Docker
// build never needs a database connection.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const t = await getTranslations({ locale, namespace: 'donate' })
  const settings = await getSiteSettings()

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/donate', settings.enabledLocales),
  }
}

export default async function DonatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ campaign?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const { campaign: campaignId } = await searchParams
  const [t, settings, providers, campaigns] = await Promise.all([
    getTranslations('donate'),
    getSiteSettings(),
    listAvailableProviders(),
    listCampaigns({ locale, limit: 50, activeOnly: true }),
  ])

  const campaign = campaignId ? campaigns.items.find((item) => item.id === campaignId) : undefined
  const currency = campaign?.currency ?? settings.donations.defaultCurrency
  const bankDetails = settings.bankTransfer

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-14">
        <DonationForm
          locale={locale}
          providers={providers}
          currencies={settings.donations.currencies}
          defaultCurrency={currency}
          suggestedAmounts={
            campaign?.suggestedAmounts.length
              ? campaign.suggestedAmounts
              : (settings.donations.suggestedAmounts[currency] ?? [])
          }
          minAmounts={settings.donations.minAmount}
          campaignId={campaign?.id ?? null}
          campaignTitle={campaign?.title ?? null}
        />

        <aside className="flex h-fit flex-col gap-4">
          {bankDetails.accountName || bankDetails.iban || bankDetails.accountNumber ? (
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-surface-foreground">
              <h2 className="mb-3 text-subheading font-semibold">{t('bankInstructions')}</h2>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ['Account', bankDetails.accountName],
                  ['Bank', bankDetails.bankName],
                  ['Account no.', bankDetails.accountNumber],
                  ['IBAN', bankDetails.iban],
                  ['SWIFT', bankDetails.swift],
                ]
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-end font-medium break-all">{value}</dd>
                    </div>
                  ))}
              </dl>
              {pickI18n(bankDetails.instructions, locale) ? (
                <div
                  className="prose-content mt-4 max-w-none text-sm"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(pickI18n(bankDetails.instructions, locale)),
                  }}
                />
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </>
  )
}
