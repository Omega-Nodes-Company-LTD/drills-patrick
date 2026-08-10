import type { Locale } from '@/i18n/config'
import { NODE_ID, ref, type GraphNode } from './graph'

/**
 * The nodes every page shares. Pages add their own on top and pass the whole
 * list to `<JsonLd>`, which emits one `@graph`.
 */

/**
 * The page itself. Everything specific — an article, a project, a campaign —
 * declares this node as its `mainEntityOfPage`, which is what ties a piece of
 * content to the URL it is published at.
 */
export function webPageNode(params: {
  locale: Locale
  url: string
  name: string
  description?: string | null
  dateModified?: Date | string | null
}): GraphNode {
  const modified =
    params.dateModified instanceof Date
      ? params.dateModified.toISOString()
      : (params.dateModified ?? undefined)

  return {
    '@type': 'WebPage',
    '@id': NODE_ID.page(params.url),
    url: params.url,
    name: params.name,
    description: params.description ?? undefined,
    inLanguage: params.locale,
    dateModified: modified,
    isPartOf: ref(NODE_ID.website(params.locale)),
  }
}
