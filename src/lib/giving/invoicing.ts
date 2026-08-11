import type { InvoicingSettings } from '@/lib/settings/schema'

/**
 * Invoice numbering and tax arithmetic.
 *
 * Every policy input here comes from the settings. What this file decides is
 * only the mechanics: how a series, year and sequence become a number, and how
 * a net amount and a rate become a total. Those are arithmetic; the rate, the
 * series and the wording that justifies an exemption are not, and are the
 * operator's to state.
 */

/**
 * Formats a number in a series.
 *
 * The year is part of it because most European series restart annually, and
 * the sequence is padded so numbers sort correctly as text — an accountant
 * sorting a column should not see 10 before 9.
 */
export function invoiceNumber(params: {
  series: string
  year: number
  sequence: number
  padding: number
}): string {
  const padded = String(params.sequence).padStart(Math.max(1, params.padding), '0')
  const series = params.series.trim()

  return series ? `${series}/${params.year}/${padded}` : `${params.year}/${padded}`
}

export type InvoiceAmounts = {
  netMinor: number
  taxMinor: number
  grossMinor: number
  taxRateBp: number
}

/**
 * Splits a received amount into net and tax.
 *
 * The gift is what actually arrived, so it is the gross: working the other way
 * would invoice a company for more than it paid. Rounding is half-up on the
 * net, and the tax is the remainder rather than a second rounded figure, so
 * the two always add back to exactly what was received.
 */
export function invoiceAmountsFromGross(grossMinor: number, taxRateBp: number): InvoiceAmounts {
  const rate = Math.max(0, Math.round(taxRateBp))

  if (rate === 0) {
    return { netMinor: grossMinor, taxMinor: 0, grossMinor, taxRateBp: 0 }
  }

  const netMinor = Math.round((grossMinor * 10_000) / (10_000 + rate))

  return { netMinor, taxMinor: grossMinor - netMinor, grossMinor, taxRateBp: rate }
}

/** The same split for a net figure entered by hand. */
export function invoiceAmountsFromNet(netMinor: number, taxRateBp: number): InvoiceAmounts {
  const rate = Math.max(0, Math.round(taxRateBp))
  const taxMinor = Math.round((netMinor * rate) / 10_000)

  return { netMinor, taxMinor, grossMinor: netMinor + taxMinor, taxRateBp: rate }
}

/** Whether invoicing can run at all — a series with no name is not a series. */
export function invoicingReady(settings: InvoicingSettings): boolean {
  return settings.enabled && settings.series.trim().length > 0
}

/** Human-readable percentage for the invoice line, e.g. 2250 → "22.5%". */
export function formatTaxRate(taxRateBp: number): string {
  const percent = taxRateBp / 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0$/, '')}%`
}
