import { intlLocale, type Locale } from '@/i18n/config'

/**
 * Amounts are stored as integers in the minor unit of their currency.
 * UGX has no minor unit, so 50 000 UGX is stored as 50000 while 50 EUR is
 * stored as 5000.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'UGX',
  'KES',
  'RWF',
  'TZS',
  'JPY',
  'KRW',
  'VND',
  'XOF',
  'XAF',
  'CLP',
  'ISK',
])

export function currencyExponent(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyExponent(currency))
}

export function fromMinorUnits(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency)
}

/**
 * Reads an amount the way a person typed it.
 *
 * The site runs in five languages, so "1.234,56", "1,234.56", "50,5" and
 * "50.5" all reach the server from the same field. `Number()` turns three of
 * those four into NaN. When both separators are present the last one is the
 * decimal point; when only one is present it is a decimal point unless it
 * groups exactly three digits.
 *
 * Returns NaN for anything that is not a number, so callers keep validating.
 */
export function parseAmount(input: unknown): number {
  if (typeof input === 'number') return input
  if (typeof input !== 'string') return Number.NaN

  const cleaned = input.replace(/[\s '’]/g, '')
  if (!cleaned) return Number.NaN

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  let normalised: string

  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const group = decimal === ',' ? '.' : ','
    normalised = cleaned.split(group).join('').replace(decimal, '.')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? ',' : '.'
    const parts = cleaned.split(separator)
    // "1.234" and "1,234,567" group thousands; "50,5" and "50.75" do not.
    const grouped = parts.length > 2 || parts[parts.length - 1]!.length === 3
    normalised = grouped ? parts.join('') : parts.join('.')
  } else {
    normalised = cleaned
  }

  return /^[+-]?\d*\.?\d*$/.test(normalised) && /\d/.test(normalised)
    ? Number(normalised)
    : Number.NaN
}

export function formatMoney(
  minor: number,
  currency: string,
  locale: Locale = 'en',
  options: { compact?: boolean; hideDecimals?: boolean } = {},
): string {
  const exponent = currencyExponent(currency)
  const value = fromMinorUnits(minor, currency)

  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: currency.toUpperCase(),
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: options.hideDecimals ? 0 : exponent,
    minimumFractionDigits: options.hideDecimals ? 0 : exponent,
  }).format(value)
}

export function formatNumber(value: number, locale: Locale = 'en', compact = false): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

/** Human-readable currency symbol, used in amount inputs. */
export function currencySymbol(currency: string, locale: Locale = 'en'): string {
  const parts = new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).formatToParts(1)
  return parts.find((part) => part.type === 'currency')?.value ?? currency.toUpperCase()
}
