import { HeartHandshake } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { listFundraisers } from '@/lib/giving/fundraisers'
import { formatMoney } from '@/lib/money'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { getSiteSettings } from '@/lib/settings/service'
import { percentage, truncate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Pages supporters run themselves.
 *
 * Ordered by amount raised rather than by date: a page with momentum is the
 * one most likely to convert a visitor, and burying it under this morning's
 * empty page helps nobody.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'fundraisers' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/fundraisers', settings.enabledLocales),
  }
}

export default async function FundraisersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tNav, items] = await Promise.all([
    getTranslations('fundraisers'),
    getTranslations('nav'),
    listFundraisers(locale),
  ])

  const url = localeUrl(locale, '/fundraisers')

  return (
    <>
      <JsonLd
        nodes={[
          webPageNode({ locale, url, name: t('title'), description: t('subtitle') }),
          sectionBreadcrumb({
            locale,
            homeName: tNav('home'),
            pageName: t('title'),
            pageUrl: url,
          }),
        ]}
      />

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page flex flex-col gap-10 py-10 md:py-14">
        <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <HeartHandshake className="size-8 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-subheading font-semibold">{t('startTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('startSubtitle')}</p>
          </div>
          <Button asChild>
            <Link href="/fundraisers/start">{t('startCta')}</Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="group relative flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-shadow hover:shadow-token"
              >
                <h3 className="text-subheading font-semibold">
                  <Link
                    href={`/fundraisers/${item.slug}`}
                    className="after:absolute after:inset-0"
                  >
                    {item.title}
                  </Link>
                </h3>

                <p className="text-sm text-muted-foreground">
                  {t('byLine', { name: item.ownerName })}
                  {item.causeTitle ? ` · ${item.causeTitle}` : ''}
                </p>

                {item.story ? (
                  <p className="text-sm text-muted-foreground">{truncate(item.story, 140)}</p>
                ) : null}

                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <Progress
                    value={percentage(item.raisedAmountMinor, item.goalAmountMinor)}
                    label={t('raised')}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-small">
                    <span className="font-semibold text-primary">
                      {formatMoney(item.raisedAmountMinor, item.currency, locale, {
                        hideDecimals: true,
                      })}
                    </span>
                    {item.goalAmountMinor > 0 ? (
                      <span className="text-muted-foreground">
                        {t('goal')}:{' '}
                        {formatMoney(item.goalAmountMinor, item.currency, locale, {
                          hideDecimals: true,
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
