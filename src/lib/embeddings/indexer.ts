import 'server-only'
import { createHash } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { contentEmbeddings, type EmbeddableEntity } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { htmlToPlainText } from '@/lib/utils'
import { embedTexts, isEmbeddingsEnabled } from './client'

/**
 * Turns published content into vector chunks.
 *
 * Chunks are keyed by (entity, id, locale, index) and carry a hash of their
 * text, so re-saving a document only re-embeds the parts that actually changed.
 */

const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150

export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  if (clean.length <= CHUNK_SIZE) return [clean]

  const chunks: string[] = []
  let start = 0

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length)

    // Prefer breaking on a sentence boundary near the end of the window.
    if (end < clean.length) {
      const window = clean.slice(start, end)
      const boundary = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('! '),
        window.lastIndexOf('? '),
      )
      if (boundary > CHUNK_SIZE * 0.5) end = start + boundary + 1
    }

    chunks.push(clean.slice(start, end).trim())
    if (end >= clean.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }

  return chunks.filter(Boolean)
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

export type IndexDocument = {
  entityType: EmbeddableEntity
  entityId: string
  locale: Locale
  title: string
  url: string
  /** Either HTML or plain text; HTML is stripped automatically. */
  body: string
}

/**
 * Indexes one document. Returns the number of chunks that were re-embedded.
 * Silently does nothing when embeddings are not configured.
 */
export async function indexDocument(doc: IndexDocument): Promise<number> {
  if (!isEmbeddingsEnabled()) return 0

  const text = [doc.title, htmlToPlainText(doc.body)].filter(Boolean).join('\n\n')
  const chunks = chunkText(text)

  if (chunks.length === 0) {
    await removeDocument(doc.entityType, doc.entityId, doc.locale)
    return 0
  }

  const existing = await db
    .select({
      chunkIndex: contentEmbeddings.chunkIndex,
      contentHash: contentEmbeddings.contentHash,
    })
    .from(contentEmbeddings)
    .where(
      and(
        eq(contentEmbeddings.entityType, doc.entityType),
        eq(contentEmbeddings.entityId, doc.entityId),
        eq(contentEmbeddings.locale, doc.locale),
      ),
    )

  const existingByIndex = new Map(existing.map((row) => [row.chunkIndex, row.contentHash]))

  const pending: { index: number; content: string; hash: string }[] = []
  chunks.forEach((content, index) => {
    const contentHash = hash(content)
    if (existingByIndex.get(index) !== contentHash) {
      pending.push({ index, content, hash: contentHash })
    }
  })

  // Drop chunks left over from a longer previous version.
  const stale = existing
    .map((row) => row.chunkIndex)
    .filter((index) => index >= chunks.length)

  if (stale.length > 0) {
    await db
      .delete(contentEmbeddings)
      .where(
        and(
          eq(contentEmbeddings.entityType, doc.entityType),
          eq(contentEmbeddings.entityId, doc.entityId),
          eq(contentEmbeddings.locale, doc.locale),
          inArray(contentEmbeddings.chunkIndex, stale),
        ),
      )
  }

  if (pending.length === 0) return 0

  const vectors = await embedTexts(pending.map((entry) => entry.content))

  for (const [position, entry] of pending.entries()) {
    const embedding = vectors[position]
    if (!embedding) continue

    await db
      .insert(contentEmbeddings)
      .values({
        entityType: doc.entityType,
        entityId: doc.entityId,
        locale: doc.locale,
        chunkIndex: entry.index,
        content: entry.content,
        title: doc.title,
        url: doc.url,
        embedding,
        contentHash: entry.hash,
        tokenCount: Math.ceil(entry.content.length / 4),
      })
      .onConflictDoUpdate({
        target: [
          contentEmbeddings.entityType,
          contentEmbeddings.entityId,
          contentEmbeddings.locale,
          contentEmbeddings.chunkIndex,
        ],
        set: {
          content: entry.content,
          title: doc.title,
          url: doc.url,
          embedding,
          contentHash: entry.hash,
          updatedAt: new Date(),
        },
      })
  }

  return pending.length
}

export async function removeDocument(
  entityType: EmbeddableEntity,
  entityId: string,
  locale?: Locale,
): Promise<void> {
  const conditions = [
    eq(contentEmbeddings.entityType, entityType),
    eq(contentEmbeddings.entityId, entityId),
  ]
  if (locale) conditions.push(eq(contentEmbeddings.locale, locale))

  await db.delete(contentEmbeddings).where(and(...conditions))
}

/**
 * Fire-and-forget indexing used by the admin save actions: a slow or failing
 * embedding provider must never block saving content.
 */
export function indexDocumentInBackground(doc: IndexDocument): void {
  if (!isEmbeddingsEnabled()) return

  void indexDocument(doc).catch((error) => {
    console.error(`[embeddings] indexing ${doc.entityType}/${doc.entityId} failed:`, error)
  })
}

export async function embeddingStats() {
  const [row] = await db
    .select({
      chunks: sql<number>`count(*)::int`,
      documents: sql<number>`count(distinct (entity_type, entity_id, locale))::int`,
    })
    .from(contentEmbeddings)

  return { chunks: row?.chunks ?? 0, documents: row?.documents ?? 0 }
}
