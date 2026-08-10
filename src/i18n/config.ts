/**
 * Locales supported by the site.
 *
 * `lg` (Luganda) has limited `Intl` support in some runtimes, so formatting
 * falls back to `en` for dates and numbers — see `intlLocale()`.
 */
export const locales = ['en', 'fr', 'it', 'de', 'lg'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  lg: 'Luganda',
}

/** Short label used in compact language switchers. */
export const localeShortLabels: Record<Locale, string> = {
  en: 'EN',
  fr: 'FR',
  it: 'IT',
  de: 'DE',
  lg: 'LG',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

/** Locale usable with the `Intl` APIs. */
export function intlLocale(locale: Locale): string {
  return locale === 'lg' ? 'en-UG' : locale
}

/**
 * Translatable string stored in JSON columns: `{ en: "Water", it: "Acqua" }`.
 * Missing locales fall back to the default locale, then to any available value.
 */
export type I18nText = Partial<Record<Locale, string>>

export function pickI18n(value: I18nText | null | undefined, locale: Locale): string {
  if (!value) return ''
  return value[locale] ?? value[defaultLocale] ?? Object.values(value).find(Boolean) ?? ''
}

export function emptyI18n(): I18nText {
  return Object.fromEntries(locales.map((locale) => [locale, ''])) as I18nText
}
