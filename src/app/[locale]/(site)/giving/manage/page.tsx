import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/site/page-header'
import { RecurringManage } from '@/components/site/recurring-manage'
import type { Locale } from '@/i18n/config'
import { annualisedMinor } from '@/lib/giving/schedule'
import { planByToken } from '@/lib/giving/statements'
import { formatMoney, fromMinorUnits } from '@/lib/money'

export const dynamic = 'force-dynamic'

/** Never indexed: the URL carries a token that stands in for a password. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ManageGivingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string; token?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  const { ref, token } = await searchParams
  setRequestLocale(locale)

  const t = await getTranslations('recurring')
  const plan = ref && token ? await planByToken(ref, token) : null

  if (!plan || !ref || !token) {
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

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="container-page max-w-2xl py-10 md:py-14">
        <RecurringManage
          reference={ref}
          token={token}
          plan={{
            status: plan.status,
            amount: String(fromMinorUnits(plan.amountMinor, plan.currency)),
            currency: plan.currency,
            interval: plan.interval,
            nextChargeOn: plan.nextChargeOn,
            pausedUntil: plan.pausedUntil,
            formattedAmount: formatMoney(plan.amountMinor, plan.currency, locale),
            annualised: formatMoney(
              annualisedMinor(plan.amountMinor, plan.interval),
              plan.currency,
              locale,
              { hideDecimals: true },
            ),
          }}
        />
      </div>
    </>
  )
}
