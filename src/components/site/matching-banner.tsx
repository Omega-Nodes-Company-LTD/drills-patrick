import { Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Progress } from '@/components/ui/progress'
import type { Locale } from '@/i18n/config'
import { pledgeProgress, remainingMinor } from '@/lib/giving/matching'
import { formatMoney } from '@/lib/money'

export type MatchingBannerPledge = {
  matcherName: string
  matcherUrl: string | null
  ratioBp: number
  ceilingMinor: number
  perDonationCapMinor: number | null
  matchedMinor: number
  currency: string
  startsAt: Date
  endsAt: Date
  isActive: boolean
}

/**
 * The live counter on a matching offer.
 *
 * Shows what is left rather than only what has been used: "€4,000 still
 * available to match" is the number that changes someone's mind today, and it
 * is also the honest one — once it reaches zero the offer is over and saying
 * so is better than quietly leaving the banner up.
 */
export async function MatchingBanner({
  pledge,
  locale,
}: {
  pledge: MatchingBannerPledge
  locale: Locale
}) {
  const t = await getTranslations('matching')
  const remaining = remainingMinor(pledge)
  const money = (minor: number) => formatMoney(minor, pledge.currency, locale, { hideDecimals: true })

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-primary/40 bg-primary/8 p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-subheading font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">
            {pledge.matcherUrl ? (
              <a
                href={pledge.matcherUrl}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="underline"
              >
                {t('by', { name: pledge.matcherName })}
              </a>
            ) : (
              t('by', { name: pledge.matcherName })
            )}
          </p>
        </div>
      </div>

      <Progress value={pledgeProgress(pledge) * 100} label={t('matchedSoFar', { amount: '' })} />

      <p className="text-sm">
        <strong className="text-primary">{t('matchedSoFar', { amount: money(pledge.matchedMinor) })}</strong>{' '}
        <span className="text-muted-foreground">{t('ceiling', { amount: money(pledge.ceilingMinor) })}</span>
      </p>

      {remaining > 0 ? (
        <p className="text-sm text-muted-foreground">{t('remaining', { amount: money(remaining) })}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('exhausted')}</p>
      )}
    </section>
  )
}
