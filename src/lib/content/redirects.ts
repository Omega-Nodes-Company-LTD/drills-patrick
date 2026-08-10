import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { slugRedirects } from '@/db/schema'
import type { Locale } from '@/i18n/config'

/**
 * Slug history.
 *
 * The editor renames things: a project gets a clearer title, an article's slug
 * is tidied before it is shared. Every rename used to turn every existing link
 * into a 404 — an inbound link from a partner, a QR code printed on a well
 * cover, a bookmark. Remembering the old slug lets the route redirect instead,
 * which also keeps whatever authority the old URL had.
 */

export type RedirectEntity = 'post' | 'project' | 'campaign' | 'page'

/**
 * Records the slugs an entity is moving away from.
 *
 * Called with the translations as they were *before* the save. A slug that is
 * being re-used by the same entity is not recorded, and any older redirect
 * claiming a slug the entity now uses is dropped — otherwise the new URL would
 * redirect to itself.
 */
export async function recordSlugChanges(params: {
  entityType: RedirectEntity
  entityId: string
  previous: { locale: string; slug: string }[]
  current: { locale: Locale; slug: string }[]
}): Promise<void> {
  const currentSlugs = new Set(params.current.map((entry) => entry.slug))

  const retired = params.previous.filter(
    (entry) => entry.slug && !currentSlugs.has(entry.slug),
  )

  // A slug now in use must not also be a redirect, whoever recorded it.
  if (currentSlugs.size > 0) {
    await db
      .delete(slugRedirects)
      .where(
        and(
          eq(slugRedirects.entityType, params.entityType),
          inArray(slugRedirects.slug, [...currentSlugs]),
        ),
      )
  }

  if (retired.length === 0) return

  await db
    .insert(slugRedirects)
    .values(
      retired.map((entry) => ({
        entityType: params.entityType,
        entityId: params.entityId,
        locale: entry.locale as Locale,
        slug: entry.slug,
      })),
    )
    // The same slug can be retired twice if it is renamed back and forth.
    .onConflictDoUpdate({
      target: [slugRedirects.entityType, slugRedirects.locale, slugRedirects.slug],
      set: { entityId: params.entityId },
    })
}

/** The entity a retired slug used to belong to, if any. */
export async function resolveRetiredSlug(
  entityType: RedirectEntity,
  slug: string,
): Promise<string | null> {
  const [row] = await db
    .select({ entityId: slugRedirects.entityId })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.slug, slug)))
    .limit(1)

  return row?.entityId ?? null
}

/** Drops the history of an entity that no longer exists. */
export async function forgetSlugs(entityType: RedirectEntity, entityId: string): Promise<void> {
  await db
    .delete(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.entityId, entityId)))
}
