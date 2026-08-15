import { Info } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { PageHeader } from '@/components/site/page-header'
import { intlLocale, type Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { listIndicators, listSpending } from '@/lib/transparency/registry'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

/**
 * Where the money goes, and how the impact figures were arrived at.
 *
 * These two belong on one page because they are the same question asked twice.
 * A donor who reads "12,000 people served" and then cannot find out what share
 * of their gift reached a drill has learned nothing.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'spending' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/spending', settings.enabledLocales),
  }
}

export default async function SpendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tNav, years, indicators] = await Promise.all([
    getTranslations('spending'),
    getTranslations('nav'),
    listSpending(locale),
    listIndicators(locale),
  ])

  const url = localeUrl(locale, '/spending')
  const percent = new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 1,
  })

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

      <div className="container-page flex flex-col gap-12 py-12">
        {indicators.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-heading">{t('indicators')}</h2>

            <ul className="grid gap-4 md:grid-cols-2">
              {indicators.map((indicator) => (
                <li
                  key={indicator.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-surface p-5"
                >
                  <p className="text-title text-primary">
                    {indicator.value}
                    {indicator.unit ? (
                      <span className="ms-1 text-heading text-foreground">{indicator.unit}</span>
                    ) : null}
                  </p>
                  <p className="font-medium">{indicator.label}</p>

                  {/* The method is on the page, not behind a tooltip. A figure
                      whose derivation is hidden is a claim, and this page
                      exists precisely to stop making claims. */}
                  {indicator.methodology ? (
                    <p className="flex gap-2 text-small text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {indicator.methodology}
                    </p>
                  ) : null}

                  <p className="mt-auto text-xs text-muted-foreground">
                    {indicator.verifiedOn
                      ? t('verifiedOn', { date: indicator.verifiedOn })
                      : t('notVerified')}
                    {indicator.source ? ` · ${indicator.source}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {years.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-muted-foreground">
            {t('empty')}
          </p>
        ) : (
          years.map((year) => (
            <section key={year.year} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-heading">{t('yearHeading', { year: year.year })}</h2>
                <p className="text-small text-muted-foreground">
                  {formatMoney(year.totalMinor, year.currency, locale, { hideDecimals: true })}
                </p>
              </div>

              {/* A real table with a bar in each row: readable as a chart, and
                  copyable as numbers. */}
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th scope="col" className="px-4 py-3 text-start font-semibold">
                        {t('category')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">
                        {t('amount')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">
                        {t('share')}
                      </th>
                      {/* Decoration only — the share is already given as a
                          number in the previous column. A third of a 360px
                          screen is too much to spend on it, so the bar appears
                          once there is room for it. */}
                      <th
                        scope="col"
                        className="hidden px-4 py-3 text-start font-semibold sm:table-cell sm:w-1/3"
                      >
                        <span className="sr-only">{t('share')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {year.categories.map((category) => (
                      <tr key={category.label} className="border-t border-border">
                        <td className="px-4 py-3">
                          {category.label}
                          {category.note ? (
                            <span className="block text-xs text-muted-foreground">
                              {category.note}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums whitespace-nowrap">
                          {formatMoney(category.amountMinor, year.currency, locale, {
                            hideDecimals: true,
                          })}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {percent.format(category.share)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span
                            className="block h-2 rounded-full bg-primary"
                            style={{ width: `${Math.max(2, category.share * 100)}%` }}
                            aria-hidden
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}
