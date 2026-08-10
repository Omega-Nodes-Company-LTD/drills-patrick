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
