import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { intlLocale, type Locale } from '@/i18n/config'

/**
 * What changed for the households: the walk and the queue.
 *
 * "Serves 800 people" is the number a funder reads. Forty minutes of walking
 * becoming five is the number the household feels, and it is the one that
 * explains why the first number matters. Rendered only when both sides of a
 * pair exist — a "before" with no "after" is not a comparison.
 */
export async function BeforeAfter({
  locale,
  walk,
  queue,
}: {
  locale: Locale
  walk: { before: number | null; after: number | null }
  queue: { before: number | null; after: number | null }
}) {
  const pairs = [
    { key: 'walk' as const, ...walk },
    { key: 'queue' as const, ...queue },
  ].filter((pair) => pair.before != null && pair.after != null)

  if (pairs.length === 0) return null

  const t = await getTranslations('beforeAfter')
  const numbers = new Intl.NumberFormat(intlLocale(locale))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-heading">{t('title')}</h2>

      <dl className="grid gap-4 sm:grid-cols-2">
        {pairs.map((pair) => {
          const saved = pair.before! - pair.after!

          return (
            <div
              key={pair.key}
              className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
            >
              <dt className="text-small text-muted-foreground">{t(pair.key)}</dt>
              <dd className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="text-heading text-muted-foreground line-through">
                  {t('minutes', { count: numbers.format(pair.before!) })}
                </span>
                <ArrowRight className="size-4 text-primary" aria-hidden />
                <span className="text-title text-primary">
                  {t('minutes', { count: numbers.format(pair.after!) })}
                </span>
              </dd>
              {saved > 0 ? (
                <p className="mt-2 text-small text-success">
                  {t('saved', { count: numbers.format(saved) })}
                </p>
              ) : null}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
