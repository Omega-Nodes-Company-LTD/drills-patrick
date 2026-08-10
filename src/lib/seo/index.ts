import type { Metadata } from 'next'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { absoluteUrl } from '@/lib/url'

/**
 * Canonical and `hreflang` builders.
 *
 * Next.js inherits `alternates` from a parent layout when a page does not set
 * it, so without an explicit canonical every page would claim the locale
 * layout's URL — the home page — as its canonical. Each route therefore builds
 * its own through these helpers.
 */

/** URL for a path in a given locale; the default locale carries no prefix. */
export function localeUrl(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return absoluteUrl(locale === defaultLocale ? clean : `/${locale}${clean}`)
}

type AlternatesInput = {
  locale: Locale
  /** Path per locale. Entities have a different slug in each language. */
  paths: Partial<Record<Locale, string>>
  /** Locales the site currently serves; others are left out of `hreflang`. */
  enabledLocales?: readonly Locale[]
}

/**
 * Canonical for the active locale plus reciprocal `hreflang` links.
 * `x-default` points at the default locale, which is what search engines use
 * when no language matches the visitor.
 */
export function buildAlternates({
  locale,
  paths,
  enabledLocales = locales,
}: AlternatesInput): Metadata['alternates'] {
  const available = (Object.keys(paths) as Locale[]).filter((entry) =>
    enabledLocales.includes(entry),
  )

  const languages: Record<string, string> = {}
  for (const entry of available) {
    languages[entry] = localeUrl(entry, paths[entry]!)
  }

  const defaultPath = paths[defaultLocale]
  if (defaultPath) {
    languages['x-default'] = localeUrl(defaultLocale, defaultPath)
  }

  // Fall back to the default locale's URL if the active locale has no path of
  // its own, so the canonical is never simply absent.
  const canonicalPath = paths[locale] ?? defaultPath
  const canonicalLocale = paths[locale] ? locale : defaultLocale

  return {
    canonical: canonicalPath ? localeUrl(canonicalLocale, canonicalPath) : undefined,
    languages: Object.keys(languages).length > 0 ? languages : undefined,
  }
}

/** Shorthand for routes whose path is identical in every language. */
export function staticAlternates(
  locale: Locale,
  path: string,
  enabledLocales: readonly Locale[] = locales,
): Metadata['alternates'] {
  return buildAlternates({
    locale,
    enabledLocales,
    paths: Object.fromEntries(enabledLocales.map((entry) => [entry, path])) as Partial<
      Record<Locale, string>
    >,
  })
}

/**
 * Turns translation rows into the path map `buildAlternates` expects.
 * `prefix` is the section, e.g. `/projects`; pages pass an empty string.
 */
export function pathsFromTranslations(
  rows: { locale: string; slug: string }[],
  prefix: string,
): Partial<Record<Locale, string>> {
  const paths: Partial<Record<Locale, string>> = {}

  for (const row of rows) {
    if ((locales as readonly string[]).includes(row.locale)) {
      paths[row.locale as Locale] = `${prefix}/${row.slug}`
    }
  }

  return paths
}
