import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'
import { intlLocale, type Locale } from '@/i18n/config'
import { buildStatement, planByToken } from '@/lib/giving/statements'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Never indexed: the URL carries a token that stands in for a password. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string; token?: string; year?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  const query = await searchParams
  setRequestLocale(locale)

  const t = await getTranslations('statement')

  // The same link that manages the standing gift opens the statement, rather
  // than a second account system built for one page.
  const plan = query.ref && query.token ? await planByToken(query.ref, query.token) : null

  if (!plan) {
    return (
      <>
        <PageHeader title={t('title')} />
        <div className="container-page max-w-2xl py-10 md:py-14">
          <p className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/8 p-4 text-sm">
            {t('badLink')}
          </p>
        </div>
      </>
    )
  }

  const year =
    query.year && /^\d{4}$/.test(query.year) ? Number(query.year) : new Date().getFullYear()

  const statement = await buildStatement({ email: plan.donorEmail, year, locale })
  const dates = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium' })
  const linkBase = `/giving/statement?ref=${encodeURIComponent(query.ref!)}&token=${encodeURIComponent(query.token!)}`

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page max-w-3xl flex flex-col gap-8 py-10 md:py-14">
        {statement.years.length > 1 ? (
          <nav className="flex flex-wrap gap-2" aria-label={t('year')}>
            {statement.years.map((option) => (
              <Link
                key={option}
                href={`${linkBase}&year=${option}`}
                className={cn(
                  'rounded-full border border-border px-3 py-1 text-sm',
                  option === year && 'bg-primary text-primary-foreground',
                )}
              >
                {option}
              </Link>
            ))}
          </nav>
        ) : null}

        <dl className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">{t('year')}</dt>
            <dd className="text-subheading font-semibold">{statement.year}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('total')}</dt>
            <dd className="text-subheading font-semibold text-primary">
              {formatMoney(statement.totalMinor, statement.currency, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('gifts')}</dt>
            <dd className="text-subheading font-semibold">{statement.lines.length}</dd>
          </div>
        </dl>

        {statement.lines.length === 0 ? (
          <p className="text-muted-foreground">{t('none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 pe-4 text-start font-medium">
                    {t('date')}
                  </th>
                  <th scope="col" className="py-2 pe-4 text-start font-medium">
                    {t('reference')}
                  </th>
                  <th scope="col" className="py-2 pe-4 text-start font-medium">
                    {t('designation')}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t('amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((line) => (
                  <tr key={line.reference} className="border-b border-border last:border-0">
                    <td className="py-2 pe-4 whitespace-nowrap">
                      {dates.format(new Date(`${line.date}T00:00:00Z`))}
                    </td>
                    <td className="py-2 pe-4 font-mono text-xs">{line.reference}</td>
                    <td className="py-2 pe-4">{line.designation ?? t('general')}</td>
                    <td className="py-2 text-end font-medium">
                      {formatMoney(line.amountMinor, line.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          Said plainly rather than implied. What counts as a tax document
          differs by country, and letting a donor assume this is one could cost
          them a deduction they were entitled to.
        */}
        <p className="text-sm text-muted-foreground">{t('notATaxReceipt')}</p>
      </div>
    </>
  )
}
