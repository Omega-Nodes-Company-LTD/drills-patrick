/**
 * How much a gift draws from a matching pledge.
 *
 * The counter on a matching campaign is a public promise, so the arithmetic
 * behind it has to be conservative in exactly one direction: it must never
 * promise money the matcher did not pledge. Every limit here — the ratio, the
 * per-gift cap, the ceiling, the window — is a term the matcher agreed to.
 */

export type Pledge = {
  ratioBp: number
  ceilingMinor: number
  perDonationCapMinor: number | null
  matchedMinor: number
  currency: string
  startsAt: Date
  endsAt: Date
  isActive: boolean
}

/** Whether the pledge is open at a given moment. */
export function pledgeIsOpen(pledge: Pledge, at: Date): boolean {
  return (
    pledge.isActive &&
    pledge.matchedMinor < pledge.ceilingMinor &&
    at >= pledge.startsAt &&
    at <= pledge.endsAt
  )
}

/** What remains of the pledge, never below zero. */
export function remainingMinor(pledge: Pledge): number {
  return Math.max(0, pledge.ceilingMinor - pledge.matchedMinor)
}

/**
 * What this gift adds.
 *
 * Returns zero rather than throwing when the pledge is closed, spent, out of
 * window or in another currency: the donation still stands on its own, and a
 * failed match must never fail a payment.
 *
 * A gift arriving as the ceiling is reached is matched partially, up to what
 * is left. Truncated rather than rounded, so the running total can never step
 * a cent past what was pledged.
 */
export function matchFor(pledge: Pledge, donation: { amountMinor: number; currency: string }, at: Date): number {
  if (!pledgeIsOpen(pledge, at)) return 0
  if (donation.currency !== pledge.currency) return 0
  if (donation.amountMinor <= 0) return 0

  const raw = Math.floor((donation.amountMinor * pledge.ratioBp) / 10_000)
  const capped = pledge.perDonationCapMinor != null
    ? Math.min(raw, pledge.perDonationCapMinor)
    : raw

  return Math.max(0, Math.min(capped, remainingMinor(pledge)))
}

/** Progress towards the ceiling, 0–1, for the public counter. */
export function pledgeProgress(pledge: Pledge): number {
  if (pledge.ceilingMinor <= 0) return 0
  return Math.min(1, pledge.matchedMinor / pledge.ceilingMinor)
}
