import type { Locale } from '@/i18n/config'
import { localeUrl } from './index'

/**
 * One JSON-LD `@graph` per page instead of scattered fragments.
 *
 * Fragments describe the same things over and over with no way to say they are
 * the same thing: an `Article` and an `Organization` in two separate scripts
 * are two unrelated islands. A single graph with stable `@id`s lets every node
 * point at the others — the article's publisher *is* the organisation node,
 * the breadcrumb's last item *is* the page — which is what both search engines
 * and answer engines follow when deciding what a page is about.
 *
 * The ids are URL fragments on the site's own origin, so they stay stable
 * across pages and languages.
 */

export type GraphNode = Record<string, unknown> & { '@type': string | string[]; '@id'?: string }

/** Stable identifiers, referenced from every page. */
export const NODE_ID = {
  organisation: (locale: Locale) => `${localeUrl(locale, '/')}#organisation`,
  website: (locale: Locale) => `${localeUrl(locale, '/')}#website`,
  page: (url: string) => `${url}#webpage`,
  breadcrumb: (url: string) => `${url}#breadcrumb`,
} as const

/** `{'@id': …}` reference to another node in the same graph. */
export function ref(id: string): { '@id': string } {
  return { '@id': id }
}

/** Drops undefined, null and empty values so the output stays readable. */
export function compact<T extends Record<string, unknown>>(node: T): T {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }

  return out as T
}

export function buildGraph(nodes: (GraphNode | null | undefined)[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes.filter((node): node is GraphNode => Boolean(node)).map(compact),
  })
}
