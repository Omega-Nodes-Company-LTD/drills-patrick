import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { defaultLocale, type Locale } from '@/i18n/config'
import { embedOne, isEmbeddingsEnabled } from '@/lib/embeddings/client'
import { truncate } from '@/lib/utils'

/**
 * Hybrid search: a keyword pass that always works, plus a vector pass when the
 * embedding provider is configured. Results are merged by entity, keeping the
 * best score of the two.
 */

export type SearchResult = {
  entityType: 'post' | 'project' | 'campaign' | 'page' | 'faq'
  entityId: string
  title: string
  url: string
  snippet: string
  score: number
  matchedBy: 'keyword' | 'semantic' | 'both'
}

type Row = {
  entity_type: SearchResult['entityType']
  entity_id: string
  title: string
  slug: string
  snippet: string
  score: number
}

const URL_PREFIX: Record<SearchResult['entityType'], string> = {
  post: '/blog/',
  project: '/projects/',
  campaign: '/campaigns/',
  page: '/',
  faq: '/faq#',
}

function buildUrl(locale: Locale, type: SearchResult['entityType'], slug: string): string {
  const path = `${URL_PREFIX[type]}${slug}`
  return locale === defaultLocale ? path : `/${locale}${path}`
}

/**
 * Keyword search over the translated columns. Uses `ILIKE` on title/summary and
 * the trigram index for tolerance to small typos.
 */
async function keywordSearch(query: string, locale: Locale, limit: number): Promise<Row[]> {
  const pattern = `%${query}%`

  const rows = await db.execute<Row>(sql`
    (
      SELECT 'post'::text AS entity_type, pt.post_id AS entity_id, pt.title, pt.slug,
             COALESCE(pt.excerpt, left(regexp_replace(pt.content_html, '<[^>]+>', ' ', 'g'), 300)) AS snippet,
             GREATEST(similarity(pt.title, ${query}), 0.35) AS score
      FROM post_translations pt
      JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
      WHERE pt.locale = ${locale}
        AND (pt.title ILIKE ${pattern} OR pt.excerpt ILIKE ${pattern} OR pt.content_html ILIKE ${pattern})
      LIMIT ${limit}
    )
    UNION ALL
    (
      SELECT 'project'::text, prt.project_id, prt.title, prt.slug,
             COALESCE(prt.summary, left(regexp_replace(prt.content_html, '<[^>]+>', ' ', 'g'), 300)),
             GREATEST(similarity(prt.title, ${query}), 0.35)
      FROM project_translations prt
      JOIN projects pr ON pr.id = prt.project_id AND pr.publish_status = 'published'
      WHERE prt.locale = ${locale}
        AND (prt.title ILIKE ${pattern} OR prt.summary ILIKE ${pattern} OR prt.content_html ILIKE ${pattern})
      LIMIT ${limit}
    )
    UNION ALL
    (
      SELECT 'campaign'::text, ct.campaign_id, ct.title, ct.slug,
             COALESCE(ct.summary, left(regexp_replace(ct.content_html, '<[^>]+>', ' ', 'g'), 300)),
             GREATEST(similarity(ct.title, ${query}), 0.35)
      FROM campaign_translations ct
      JOIN campaigns c ON c.id = ct.campaign_id AND c.status = 'published'
      WHERE ct.locale = ${locale}
        AND (ct.title ILIKE ${pattern} OR ct.summary ILIKE ${pattern} OR ct.content_html ILIKE ${pattern})
      LIMIT ${limit}
    )
    UNION ALL
    (
      -- FAQs answer the questions people actually type into a search box, and
      -- were reachable only through the semantic pass — which is optional, so
      -- on an installation without an embeddings key they could not be found
      -- at all. The id stands in for the slug: the answers live on one page,
      -- addressed by anchor.
      SELECT 'faq'::text, ft.faq_id, ft.question, ft.faq_id::text,
             left(regexp_replace(ft.answer_html, '<[^>]+>', ' ', 'g'), 300),
             GREATEST(similarity(ft.question, ${query}), 0.35)
      FROM faq_translations ft
      JOIN faqs f ON f.id = ft.faq_id AND f.is_published = true
      WHERE ft.locale = ${locale}
        AND (ft.question ILIKE ${pattern} OR ft.answer_html ILIKE ${pattern})
      LIMIT ${limit}
    )
    UNION ALL
    (
      -- Pages carry their text in blocks rather than a column, so only the
      -- title and the SEO description can be matched here. Better than a page
      -- that cannot be found by name.
      SELECT 'page'::text, pgt.page_id, pgt.title, pgt.slug,
             COALESCE(pgt.seo_description, ''),
             GREATEST(similarity(pgt.title, ${query}), 0.35)
      FROM page_translations pgt
      JOIN pages pg ON pg.id = pgt.page_id AND pg.status = 'published'
      WHERE pgt.locale = ${locale}
        AND (pgt.title ILIKE ${pattern} OR pgt.seo_description ILIKE ${pattern})
      LIMIT ${limit}
    )
    ORDER BY score DESC
    LIMIT ${limit}
  `)

  return rows as unknown as Row[]
}

type VectorRow = {
  entity_type: SearchResult['entityType']
  entity_id: string
  title: string
  url: string
  content: string
  distance: number
}

async function semanticSearch(
  query: string,
  locale: Locale,
  limit: number,
): Promise<VectorRow[]> {
  const vector = await embedOne(query)
  if (!vector) return []

  const literal = `[${vector.join(',')}]`

  const rows = await db.execute<VectorRow>(sql`
    SELECT DISTINCT ON (entity_type, entity_id)
      entity_type, entity_id, title, url, content,
      embedding <=> ${literal}::vector AS distance
    FROM content_embeddings
    WHERE locale = ${locale} AND embedding IS NOT NULL
    ORDER BY entity_type, entity_id, distance
    LIMIT ${limit * 3}
  `)

  return (rows as unknown as VectorRow[])
    .sort((a, b) => Number(a.distance) - Number(b.distance))
    .slice(0, limit)
}

export async function search(
  query: string,
  locale: Locale,
  limit = 20,
): Promise<{ results: SearchResult[]; semantic: boolean }> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return { results: [], semantic: false }

  const [keyword, semantic] = await Promise.all([
    keywordSearch(trimmed, locale, limit).catch((error) => {
      console.error('[search] keyword pass failed:', error)
      return [] as Row[]
    }),
    isEmbeddingsEnabled()
      ? semanticSearch(trimmed, locale, limit).catch((error) => {
          console.error('[search] semantic pass failed:', error)
          return [] as VectorRow[]
        })
      : Promise.resolve([] as VectorRow[]),
  ])

  const merged = new Map<string, SearchResult>()

  for (const row of keyword) {
    const key = `${row.entity_type}:${row.entity_id}`
    merged.set(key, {
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      url: buildUrl(locale, row.entity_type, row.slug),
      snippet: truncate(row.snippet?.replace(/\s+/g, ' ').trim() ?? '', 220),
      score: Number(row.score) || 0.35,
      matchedBy: 'keyword',
    })
  }

  for (const row of semantic) {
    const key = `${row.entity_type}:${row.entity_id}`
    // Cosine distance in [0, 2]; closer is better.
    const score = Math.max(0, 1 - Number(row.distance))
    const existing = merged.get(key)

    if (existing) {
      existing.score = Math.max(existing.score, score) + 0.15
      existing.matchedBy = 'both'
    } else {
      merged.set(key, {
        entityType: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        url: row.url,
        snippet: truncate(row.content.replace(/\s+/g, ' ').trim(), 220),
        score,
        matchedBy: 'semantic',
      })
    }
  }

  return {
    results: [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit),
    semantic: semantic.length > 0,
  }
}
