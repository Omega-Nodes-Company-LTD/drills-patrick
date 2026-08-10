import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/db'
import { media, type MediaRow } from '@/db/schema'
import { deleteObjects } from '@/lib/storage/s3'

/** Request-scoped memoisation: the same asset is often referenced many times. */
export const getMediaById = cache(async (id: string | null | undefined): Promise<MediaRow | null> => {
  if (!id) return null
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1)
  return row ?? null
})

export const getMediaByIds = cache(async (ids: string[]): Promise<Map<string, MediaRow>> => {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const rows = await db.select().from(media).where(inArray(media.id, unique))
  return new Map(rows.map((row) => [row.id, row]))
})

export type MediaListFilters = {
  search?: string
  folder?: string
  kind?: MediaRow['kind']
  page?: number
  perPage?: number
}

export async function listMedia(filters: MediaListFilters = {}) {
  const perPage = Math.min(filters.perPage ?? 24, 100)
  const page = Math.max(filters.page ?? 1, 1)

  const conditions = []
  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(
      or(ilike(media.originalName, term), ilike(media.objectKey, term), ilike(media.credit, term)),
    )
  }
  if (filters.folder && filters.folder !== 'all') conditions.push(eq(media.folder, filters.folder))
  if (filters.kind) conditions.push(eq(media.kind, filters.kind))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [items, [countRow]] = await Promise.all([
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(media).where(where),
  ])

  return {
    items,
    total: countRow?.count ?? 0,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil((countRow?.count ?? 0) / perPage)),
  }
}

export async function listMediaFolders(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ folder: media.folder })
    .from(media)
    .orderBy(media.folder)
  return rows.map((row) => row.folder)
}

/** Removes the database row and every object (original plus derivatives). */
export async function deleteMedia(id: string): Promise<void> {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1)
  if (!row) return

  const keys = [row.objectKey, ...Object.values(row.variants ?? {})]

  try {
    await deleteObjects(keys)
  } catch (error) {
    // A missing remote object must not block cleaning up the library.
    console.error('[media] failed to delete objects:', error)
  }

  await db.delete(media).where(eq(media.id, id))
}
