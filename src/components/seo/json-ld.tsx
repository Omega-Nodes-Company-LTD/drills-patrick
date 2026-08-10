import { buildGraph, type GraphNode } from '@/lib/seo/graph'

/**
 * Renders the page's structured data as one `@graph`.
 *
 * `JSON.stringify` cannot emit `</script`, so the payload cannot close the
 * tag it lives in; the remaining risk is `<!--`, which is stripped below.
 */
export function JsonLd({ nodes }: { nodes: (GraphNode | null | undefined)[] }) {
  const json = buildGraph(nodes).replace(/</g, '\\u003c')
  if (json === '{"@context":"https://schema.org","@graph":[]}') return null

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
