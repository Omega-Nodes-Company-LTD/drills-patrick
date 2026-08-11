/**
 * When a standing gift is next taken.
 *
 * Date arithmetic on calendar months is where these things break: a gift set
 * up on the 31st has no 31st to land on in February, and the naive answer
 * silently rolls it into March, skipping a month. Clamping to the last day of
 * the target month keeps the schedule monthly, which is what was agreed.
 */

export type Interval = 'monthly' | 'quarterly' | 'yearly'

const MONTHS: Record<Interval, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** ISO date, in UTC — these are calendar dates, not moments. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Advances a date by one interval, keeping the day of the month where it can.
 *
 * A gift on the 31st becomes the 28th in February and then returns to the 31st
 * in March, because the anchor is the original day rather than whatever last
 * month was clamped to. Passing the anchor separately is what makes that
 * possible — without it, one short month permanently moves the gift earlier.
 */
export function advance(from: Date, interval: Interval, anchorDay?: number): string {
  const day = anchorDay ?? from.getUTCDate()
  const target = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + MONTHS[interval], 1),
  )

  const clamped = Math.min(day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()))
  target.setUTCDate(clamped)

  return isoDate(target)
}

/**
 * The next charge date for a plan, skipping any that are already past.
 *
 * A plan paused for six months must not wake up owing six payments: the donor
 * agreed to give monthly, not to a debt. So the schedule catches up to today
 * rather than replaying what was missed.
 */
export function nextChargeAfter(params: {
  from: Date
  interval: Interval
  today: Date
  anchorDay?: number
}): string {
  const anchor = params.anchorDay ?? params.from.getUTCDate()
  let cursor = params.from

  // Bounded: yearly steps clear any realistic gap long before this.
  for (let step = 0; step < 400; step += 1) {
    const next = advance(cursor, params.interval, anchor)
    if (new Date(`${next}T00:00:00Z`) > params.today) return next
    cursor = new Date(`${next}T00:00:00Z`)
  }

  return isoDate(params.today)
}

/** What a plan gives in a year, for the "your gift funds X" line. */
export function annualisedMinor(amountMinor: number, interval: Interval): number {
  return Math.round((amountMinor * 12) / MONTHS[interval])
}
