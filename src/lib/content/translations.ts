import { defaultLocale, type Locale } from '@/i18n/config'

type WithLocale = { locale: string }

/**
 * Picks the translation for `locale`, falling back to the default locale and
 * then to whatever exists. Content is rarely translated into all five
 * languages at once, and a partially translated site must still render.
 */
export function pickTranslation<T extends WithLocale>(
  rows: T[] | undefined,
  locale: Locale,
): T | undefined {
  if (!rows || rows.length === 0) return undefined
  return (
    rows.find((row) => row.locale === locale) ??
    rows.find((row) => row.locale === defaultLocale) ??
    rows[0]
  )
}

/** Groups translation rows by their parent id, ready for `pickTranslation`. */
export function groupByParent<T extends WithLocale & Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const parentId = String(row[key])
    const list = map.get(parentId)
    if (list) list.push(row)
    else map.set(parentId, [row])
  }
  return map
}

/** True when the entity has real content in that locale (not a fallback). */
export function hasTranslation<T extends WithLocale>(rows: T[] | undefined, locale: Locale) {
  return Boolean(rows?.some((row) => row.locale === locale))
}
