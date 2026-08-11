import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { PageHeader } from '@/components/site/page-header'
import { ShareButtons } from '@/components/site/share-buttons'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { fundraiserSupporters, getFundraiser } from '@/lib/giving/fundraisers'
import { formatMoney } from '@/lib/money'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { getSiteSettings } from '@/lib/settings/service'
import { percentage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  const [fundraiser, settings] = await Promise.all([getFundraiser(slug, locale), getSiteSettings()])

  if (!fundraiser) return {}

  return {
    title: fundraiser.title,
    description: fundraiser.story.slice(0, 200) || undefined,
    alternates: staticAlternates(locale, `/fundraisers/${slug}`, settings.enabledLocales),
  }
}

export default async function FundraiserPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  setRequestLocale(locale)

  const [t, tNav, fundraiser] = await Promise.all([
    getTranslations('fundraisers'),
    getTranslations('nav'),
    getFundraiser(slug, locale),
  ])

  if (!fundraiser) notFound()

  const supporters = await fundraiserSupporters(fundraiser.id)
  const url = localeUrl(locale, `/fundraisers/${slug}`)
  const donateHref = `/donate?fundraiser=${encodeURIComponent(fundraiser.slug)}`

  return (
    <>
      <JsonLd
        nodes={[
          webPageNode({ locale, url, name: fundraiser.title, description: fundraiser.story.slice(0, 200) }),
          sectionBreadcrumb({
            locale,
            homeName: tNav('home'),
            section: { name: t('title'), path: '/fundraisers' },
            pageName: fundraiser.title,
            pageUrl: url,
          }),
        ]}
      />

      <PageHeader
        title={fundraiser.title}
        subtitle={t('byLine', { name: fundraiser.ownerName })}
      />

      <div className="container-page grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {fundraiser.story ? (
            <div className="prose-token whitespace-pre-wrap text-base leading-relaxed">
              {fundraiser.story}
            </div>
          ) : null}

          {fundraiser.causeTitle && fundraiser.causeHref ? (
            <p className="text-sm text-muted-foreground">
              {t('supporting')}:{' '}
              <Link href={fundraiser.causeHref} className="font-medium text-primary underline">
                {fundraiser.causeTitle}
              </Link>
            </p>
          ) : null}

          <ShareButtons title={fundraiser.title} />

          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-subheading font-semibold">{t('supporters')}</h2>
            {supporters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noSupporters')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {supporters.map((supporter) => (
                  <li
                    key={supporter.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3 text-sm last:border-0"
                  >
                    <span className="font-medium">
                      {/* Anonymity is honoured here exactly as on the wall. */}
                      {supporter.isAnonymous
                        ? t('anonymous')
                        : supporter.displayName || supporter.name || t('anonymous')}
                    </span>
                    <span className="text-primary">
                      {formatMoney(supporter.amountMinor, supporter.currency, locale, {
                        hideDecimals: true,
                      })}
                    </span>
                    {supporter.message ? (
                      <p className="w-full text-muted-foreground">{supporter.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex h-fit flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6 lg:sticky lg:top-24">
          <Progress
            value={percentage(fundraiser.raisedAmountMinor, fundraiser.goalAmountMinor)}
            label={t('raised')}
          />
          <p className="text-heading font-bold text-primary">
            {formatMoney(fundraiser.raisedAmountMinor, fundraiser.currency, locale, {
              hideDecimals: true,
            })}
          </p>
          {fundraiser.goalAmountMinor > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('goal')}:{' '}
              {formatMoney(fundraiser.goalAmountMinor, fundraiser.currency, locale, {
                hideDecimals: true,
              })}
            </p>
          ) : null}

          <Button asChild size="lg">
            <Link href={donateHref}>{t('donateCta')}</Link>
          </Button>

          {fundraiser.endsOn ? (
            <p className="text-sm text-muted-foreground">
              {t('endsOn')}: {fundraiser.endsOn}
            </p>
          ) : null}
        </aside>
      </div>
    </>
  )
}
