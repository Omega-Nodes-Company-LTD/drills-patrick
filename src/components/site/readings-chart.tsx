import { getTranslations } from 'next-intl/server'
import { intlLocale, type Locale } from '@/i18n/config'
import type { WaterPointReadingRow } from '@/db/schema'

/**
 * Yield and water level over time.
 *
 * Inline SVG rather than a charting library: it is one series, it must render
 * on the server so a crawler and a reader on a slow connection both see the
 * numbers, and the whole point is that the shape of the line — a borehole
 * declining season by season — is visible without JavaScript.
 *
 * The table underneath is not a fallback. It is the accessible version and the
 * one somebody will copy into a spreadsheet.
 */

const WIDTH = 720
const HEIGHT = 200
const PADDING = { top: 12, right: 12, bottom: 28, left: 44 }

export async function ReadingsChart({
  readings,
  locale,
}: {
  readings: WaterPointReadingRow[]
  locale: Locale
}) {
  const t = await getTranslations('readings')

  const points = readings.filter((reading) => reading.yieldLitersPerHour != null)
  if (points.length < 2) return null

  const numbers = new Intl.NumberFormat(intlLocale(locale))
  const dates = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', year: 'numeric' })

  const values = points.map((point) => point.yieldLitersPerHour!)
  const times = points.map((point) => new Date(`${point.measuredOn}T00:00:00Z`).getTime())

  const maxValue = Math.max(...values)
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const timeSpan = maxTime - minTime || 1

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  // The scale starts at zero, always. A truncated axis turns a 10% drop into a
  // cliff, and this chart exists to be trusted rather than to look dramatic.
  const x = (time: number) => PADDING.left + ((time - minTime) / timeSpan) * plotWidth
  const y = (value: number) => PADDING.top + plotHeight - (value / (maxValue || 1)) * plotHeight

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(times[index]!)} ${y(values[index]!)}`)
    .join(' ')

  const first = values[0]!
  const last = values[values.length - 1]!
  const change = first > 0 ? (last - first) / first : 0

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-heading">{t('title')}</h2>
        <p className={change < -0.2 ? 'text-small text-danger' : 'text-small text-muted-foreground'}>
          {t('change', {
            percent: new Intl.NumberFormat(intlLocale(locale), {
              style: 'percent',
              maximumFractionDigits: 0,
              signDisplay: 'exceptZero',
            }).format(change),
          })}
        </p>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-48 w-full min-w-[36rem]"
          role="img"
          aria-label={t('title')}
        >
          {/* Baseline and top gridline, labelled: an unlabelled axis is decoration. */}
          {[0, maxValue].map((value) => (
            <g key={value}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--c-border)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={y(value) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--c-muted-foreground)"
              >
                {numbers.format(value)}
              </text>
            </g>
          ))}

          <path d={path} fill="none" stroke="var(--c-primary)" strokeWidth={2.5} />

          {points.map((point, index) => (
            <circle
              key={point.id}
              cx={x(times[index]!)}
              cy={y(values[index]!)}
              r={3.5}
              fill="var(--c-primary)"
            />
          ))}

          <text
            x={PADDING.left}
            y={HEIGHT - 8}
            fontSize={11}
            fill="var(--c-muted-foreground)"
          >
            {dates.format(new Date(minTime))}
          </text>
          <text
            x={WIDTH - PADDING.right}
            y={HEIGHT - 8}
            textAnchor="end"
            fontSize={11}
            fill="var(--c-muted-foreground)"
          >
            {dates.format(new Date(maxTime))}
          </text>
        </svg>
      </div>

      <details className="rounded-[var(--radius-lg)] border border-border">
        <summary className="cursor-pointer px-4 py-3 text-small font-medium">
          {t('showTable')}
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th scope="col" className="px-4 py-2 text-start font-semibold">
                  {t('date')}
                </th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">
                  {t('yield')}
                </th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">
                  {t('level')}
                </th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">
                  {t('note')}
                </th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id} className="border-t border-border">
                  <td className="px-4 py-2 whitespace-nowrap">{reading.measuredOn}</td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {reading.yieldLitersPerHour
                      ? `${numbers.format(reading.yieldLitersPerHour)} l/h`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {reading.staticLevelM != null ? `${reading.staticLevelM} m` : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{reading.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
