import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { listSupporterWall, wallYears } from '@/lib/giving/wall'
import { listingRobots, localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { getSiteSettings } from '@/lib/settings/service'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Names, and nothing else.
 *
 * No amounts anywhere on this page: publishing what each person gave turns a
 * wall of thanks into a league table, and the people who give the most
 * relative to their means come off worst in one.
 */

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ year?: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const query = await searchParams
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'supporters' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/supporters', settings.enabledLocales),
    robots: listingRobots({ year: query.year }),
  }
}

export default async function SupportersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const query = await searchParams
  const selected = query.year && /^\d{4}$/.test(query.year) ? Number(query.year) : undefined

  const [t, tNav, tCommon, years, entries] = await Promise.all([
    getTranslations('supporters'),
    getTranslations('nav'),
    getTranslations('common'),
    wallYears(),
    listSupporterWall({ sinceYear: selected }),
  ])

  const url = localeUrl(locale, '/supporters')

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

      <div className="container-page flex flex-col gap-8 py-10 md:py-14">
        {years.length > 1 ? (
          <nav className="flex flex-wrap gap-2" aria-label={t('title')}>
            <Link
              href="/supporters"
              className={cn(
                'rounded-full border border-border px-3 py-1 text-sm',
                !selected && 'bg-primary text-primary-foreground',
              )}
            >
              {tCommon('all')}
            </Link>
            {years.map((year) => (
              <Link
                key={year}
                href={`/supporters?year=${year}`}
                className={cn(
                  'rounded-full border border-border px-3 py-1 text-sm',
                  selected === year && 'bg-primary text-primary-foreground',
                )}
              >
                {year}
              </Link>
            ))}
          </nav>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <li key={entry.name} className="border-b border-border py-2 text-sm">
                {entry.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
