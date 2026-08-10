import { getTranslations } from 'next-intl/server'
import { intlLocale, type Locale } from '@/i18n/config'
import type { SlaMetrics } from '@/lib/ngo/faults'

/**
 * Service figures: how fast faults are answered and how many water points are
 * working.
 *
 * These are the numbers an NGO asks for at renewal time, and the ones nobody
 * can produce from an inbox. Medians, not averages — one well cut off by
 * flooding for three weeks would otherwise make the whole figure meaningless.
 */
export async function SlaCards({ metrics, locale }: { metrics: SlaMetrics; locale: Locale }) {
  const t = await getTranslations('admin.faults')

  const hours = (value: number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(value)

  const cards = [
    { label: t('open'), value: String(metrics.open), tone: metrics.open > 0 ? 'warning' : 'ok' },
    { label: t('reported12m'), value: String(metrics.reported), tone: 'ok' },
    { label: t('medianAck'), value: `${hours(metrics.medianAcknowledgeHours)} h`, tone: 'ok' },
    { label: t('medianResolve'), value: `${hours(metrics.medianResolveHours)} h`, tone: 'ok' },
    {
      label: t('functional'),
      value:
        metrics.functionalRate === null
          ? '—'
          : new Intl.NumberFormat(intlLocale(locale), { style: 'percent' }).format(
              metrics.functionalRate,
            ),
      tone: 'ok',
    },
  ]

  return (
    <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
        >
          <dt className="text-xs text-muted-foreground">{card.label}</dt>
          <dd
            className={
              card.tone === 'warning' ? 'text-heading text-warning' : 'text-heading'
            }
          >
            {card.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
