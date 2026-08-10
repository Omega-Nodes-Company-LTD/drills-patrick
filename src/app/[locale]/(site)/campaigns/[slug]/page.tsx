import type { Metadata } from 'next'
import { buildAlternates, pathsFromTranslations } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DonationForm } from '@/components/donate/donation-form'
import { MediaImage } from '@/components/ui/media-image'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { getCampaignBySlug } from '@/lib/content/queries'
import { formatMoney } from '@/lib/money'
import { listAvailableProviders } from '@/lib/payments/registry'
import { sanitizeHtml } from '@/lib/sanitize'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'
import { percentage } from '@/lib/utils'
import { pickI18n } from '@/i18n/config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  const result = await getCampaignBySlug(slug, locale)
  if (!result) return {}

  const settings = await getSiteSettings()

  const image = mediaUrl(result.cover?.objectKey)

  return {
    title: result.translation?.seoTitle || result.translation?.title,
    description: result.translation?.seoDescription || result.translation?.summary || undefined,
    // Own canonical: without it the page would inherit the locale layout's,
    // which points at the home page.
    alternates: buildAlternates({
      locale,
      paths: pathsFromTranslations(result.translations, '/campaigns'),
      enabledLocales: settings.enabledLocales,
    }),
    openGraph: { title: result.translation?.title, images: image ? [image] : undefined },
  }
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  setRequestLocale(locale)

  const result = await getCampaignBySlug(slug, locale)
  if (!result) notFound()

  const [t, settings, providers] = await Promise.all([
    getTranslations('campaigns'),
    getSiteSettings(),
    listAvailableProviders(),
  ])

  const { campaign, translation, cover, supporters } = result
  const raised = campaign.raisedAmount + campaign.offlineAmount
  const progress = percentage(raised, campaign.goalAmount)
  const remaining = Math.max(0, campaign.goalAmount - raised)

  const daysLeft = campaign.endsOn
    ? Math.ceil((new Date(campaign.endsOn).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <article className="pb-16">
      {cover ? (
        <div className="relative aspect-[16/9] max-h-[26rem] w-full overflow-hidden bg-muted md:aspect-[21/9]">
          <MediaImage media={cover} locale={locale} priority sizes="100vw" />
        </div>
      ) : null}

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-14">
        <div className="flex flex-col gap-6">
          <h1 className="text-title">{translation?.title}</h1>
          {translation?.summary ? (
            <p className="text-lg text-muted-foreground">{translation.summary}</p>
          ) : null}

          {translation?.contentHtml ? (
            <div
              className="prose-content max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(translation.contentHtml) }}
            />
          ) : null}

          {campaign.impactTiers.length > 0 ? (
            <section className="rounded-[var(--radius-lg)] border border-border p-5">
              <h2 className="mb-3 text-subheading font-semibold">{t('supportCampaign')}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {campaign.impactTiers.map((tier, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="font-semibold text-primary">
                      {formatMoney(tier.amount, campaign.currency, locale, { hideDecimals: true })}
                    </span>
                    <span className="text-muted-foreground">{pickI18n(tier.label, locale)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {campaign.projectId ? (
            <Button asChild variant="outline" className="self-start">
              <Link href={`/projects`}>{t('linkedProject')}</Link>
            </Button>
          ) : null}
        </div>

        <aside className="flex h-fit flex-col gap-5 lg:sticky lg:top-24">
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-surface-foreground">
            <Progress value={progress} label={t('raised')} />
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-heading text-heading font-bold text-primary">
                {formatMoney(raised, campaign.currency, locale, { hideDecimals: true })}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('goal')}:{' '}
                {formatMoney(campaign.goalAmount, campaign.currency, locale, { hideDecimals: true })}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('remaining')}</dt>
                <dd className="font-medium">
                  {formatMoney(remaining, campaign.currency, locale, { hideDecimals: true })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('supporters', { count: supporters })}</dt>
                <dd className="font-medium">{supporters}</dd>
              </div>
            </dl>
            {daysLeft !== null ? (
              <p className="text-sm text-muted-foreground">
                {daysLeft > 0 ? t('daysLeft', { count: daysLeft }) : t('ended')}
              </p>
            ) : null}
          </div>

          {settings.features.donations && (daysLeft === null || daysLeft > 0) ? (
            <DonationForm
              locale={locale}
              providers={providers}
              currencies={settings.donations.currencies}
              defaultCurrency={campaign.currency}
              suggestedAmounts={
                campaign.suggestedAmounts.length > 0
                  ? campaign.suggestedAmounts
                  : (settings.donations.suggestedAmounts[campaign.currency] ?? [])
              }
              minAmounts={settings.donations.minAmount}
              campaignId={campaign.id}
              campaignTitle={translation?.title ?? null}
              projectId={campaign.projectId}
            />
          ) : null}
        </aside>
      </div>
    </article>
  )
}
