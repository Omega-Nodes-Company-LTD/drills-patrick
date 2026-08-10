import { CalendarClock } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requirePartner } from '@/app/actions/partner'
import { PortalHeader } from '@/components/portal/portal-header'
import { Badge } from '@/components/ui/badge'
import { intlLocale, type Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'
import { listPortalContracts } from '@/lib/ngo/portal'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } }
}

export default async function PortalContractsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const session = await requirePartner(locale)
  const [t, contracts] = await Promise.all([
    getTranslations('portal'),
    listPortalContracts(session.partnerId),
  ])

  const today = new Date().toISOString().slice(0, 10)

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00Z`))

  return (
    <div className="container-page py-10">
      <PortalHeader session={session} locale={locale} active="contracts" />

      {contracts.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-muted-foreground">
          {t('noContracts')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {contracts.map((contract) => {
            // A visit that is already late is the thing the partner opened this
            // page to find out, so it is a badge rather than a line of text.
            const overdue = contract.nextVisitDue < today && contract.isActive

            return (
              <li
                key={contract.id}
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-heading text-lg font-semibold">{contract.reference}</h2>
                  <Badge variant={contract.isActive ? 'success' : 'outline'}>
                    {formatDate(contract.startsOn)} — {formatDate(contract.endsOn)}
                  </Badge>
                </div>

                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [t('coverage'), String(contract.projectCount)],
                    [t('visits'), String(contract.visitCount)],
                    [t('lastVisit'), contract.lastVisit ? formatDate(contract.lastVisit) : '—'],
                    [t('responseTime'), t('hours', { count: contract.responseHours })],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <CalendarClock
                    className={overdue ? 'size-4 text-danger' : 'size-4 text-primary'}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{t('nextVisit')}:</span>
                  <span className={overdue ? 'font-semibold text-danger' : 'font-semibold'}>
                    {formatDate(contract.nextVisitDue)}
                  </span>
                  {contract.feeMinor > 0 ? (
                    <span className="ms-auto text-muted-foreground">
                      {formatMoney(contract.feeMinor, contract.currency, locale, {
                        hideDecimals: true,
                      })}
                    </span>
                  ) : null}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
