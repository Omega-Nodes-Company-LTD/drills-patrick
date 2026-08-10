import type { DrillingRateRow } from '@/db/schema'

/**
 * Turning a depth and a geology into a price.
 *
 * Drilling is not priced per borehole: it is priced per metre, and the rate
 * changes with depth band and with what the drill hits. Soft overburden and
 * hard basement at sixty metres are different jobs. On top of the metres come
 * the one-off items — mobilisation, casing, pump, apron — which do not scale
 * with depth at all.
 *
 * Pure, so the same arithmetic runs in the estimator the visitor sees and in
 * the quote the office issues, and so it can be tested without a database.
 */

export type QuoteLine = {
  label: string
  quantity: number
  unitMinor: number
  totalMinor: number
}

export type QuoteResult = {
  lines: QuoteLine[]
  subtotalMinor: number
  totalMinor: number
  currency: string
  /** True when no rate covers the request; the caller must not show a price. */
  incomplete: boolean
}

/** Rates that apply to a depth and geology, most specific geology first. */
export function applicableRates(
  rates: DrillingRateRow[],
  params: { depthM: number; geology: string },
): DrillingRateRow[] {
  return rates
    .filter((rate) => rate.isActive)
    .filter((rate) => params.depthM > rate.depthFromM && params.depthM >= 0)
    .filter((rate) => rate.geology === params.geology || rate.geology === 'any')
    .sort((a, b) => {
      // An exact geology match beats the catch-all at the same depth band.
      if (a.geology !== b.geology) return a.geology === 'any' ? 1 : -1
      return a.depthFromM - b.depthFromM
    })
}

export function buildQuote(
  rates: DrillingRateRow[],
  params: { depthM: number; geology: string; wellsCount: number; currency?: string },
): QuoteResult {
  const wells = Math.max(1, Math.floor(params.wellsCount))
  const depth = Math.max(0, params.depthM)
  const candidates = applicableRates(rates, { depthM: depth, geology: params.geology })

  if (candidates.length === 0) {
    return {
      lines: [],
      subtotalMinor: 0,
      totalMinor: 0,
      currency: params.currency ?? 'UGX',
      incomplete: true,
    }
  }

  const currency = params.currency ?? candidates[0]!.currency
  const lines: QuoteLine[] = []
  const seenBands = new Set<string>()

  // Depth is billed band by band: the first thirty metres at the shallow rate,
  // the rest at the deeper one, rather than the whole hole at a single price.
  for (const rate of candidates) {
    const bandKey = `${rate.depthFromM}-${rate.depthToM}`
    if (seenBands.has(bandKey)) continue
    seenBands.add(bandKey)

    const metres = Math.max(0, Math.min(depth, rate.depthToM) - rate.depthFromM)
    if (metres > 0 && rate.ratePerMetreMinor > 0) {
      const quantity = metres * wells
      lines.push({
        label: rate.label,
        quantity,
        unitMinor: rate.ratePerMetreMinor,
        totalMinor: quantity * rate.ratePerMetreMinor,
      })
    }

    if (rate.fixedCostMinor > 0) {
      lines.push({
        label: `${rate.label} — fixed`,
        quantity: wells,
        unitMinor: rate.fixedCostMinor,
        totalMinor: wells * rate.fixedCostMinor,
      })
    }
  }

  const subtotalMinor = lines.reduce((total, line) => total + line.totalMinor, 0)

  return {
    lines,
    subtotalMinor,
    totalMinor: subtotalMinor,
    currency,
    // A quote of zero is not a quote: it means the rate table has a hole in it.
    incomplete: subtotalMinor === 0,
  }
}

/** Human reference for a quote, quotable over the phone. */
export function quoteReference(prefix = 'Q'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`
}
