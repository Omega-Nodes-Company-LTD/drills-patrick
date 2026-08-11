import 'server-only'
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  projectTranslations,
  projectUpdateTranslations,
  projectUpdates,
  wellAdoptions,
} from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { pickTranslation } from '@/lib/content/translations'

/**
 * People who stand behind one water point.
 *
 * The promise made to an adopter is not "your money went somewhere" but "this
 * well is yours to follow", so the interesting query is not who adopted what:
 * it is who is owed an update and has not had one.
 */

/** Adopters who agreed to be named, for the water point's own page. */
export async function publicAdopters(projectId: string) {
  return db
    .select({
      id: wellAdoptions.id,
      donorName: wellAdoptions.donorName,
      donorOrganisation: wellAdoptions.donorOrganisation,
      startedOn: wellAdoptions.startedOn,
    })
    .from(wellAdoptions)
    .where(
      and(
        eq(wellAdoptions.projectId, projectId),
        eq(wellAdoptions.isActive, true),
        eq(wellAdoptions.isPublic, true),
      ),
    )
    .orderBy(wellAdoptions.startedOn)
}

/**
 * Adoptions whose next update is due.
 *
 * An adoption that has never had one is due immediately: the first update is
 * the one that proves the promise was real, and letting it wait a full cycle
 * is how the whole thing quietly stops meaning anything.
 */
export async function adoptionsDue(now = new Date()) {
  return db
    .select()
    .from(wellAdoptions)
    .where(
      and(
        eq(wellAdoptions.isActive, true),
        or(
          isNull(wellAdoptions.endsOn),
          gt(wellAdoptions.endsOn, now.toISOString().slice(0, 10)),
        ),
        or(
          isNull(wellAdoptions.lastUpdateSentAt),
          lte(
            wellAdoptions.lastUpdateSentAt,
            sql`${now} - (${wellAdoptions.updateEveryMonths} || ' months')::interval`,
          ),
        ),
      ),
    )
    .limit(200)
}

/**
 * What has happened at a water point since a given moment.
 *
 * Returns an empty list rather than falling back to older entries: an update
 * email that recycles news the adopter already had is worse than one that
 * says nothing happened, because the second is at least true.
 */
export async function updatesSince(projectId: string, since: Date | null, locale: Locale) {
  const rows = await db
    .select()
    .from(projectUpdates)
    .where(
      and(
        eq(projectUpdates.projectId, projectId),
        eq(projectUpdates.isPublished, true),
        since ? gt(projectUpdates.createdAt, since) : undefined,
      ),
    )
    .orderBy(desc(projectUpdates.happenedOn))
    .limit(10)

  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(projectUpdateTranslations)
    .where(
      inArray(
        projectUpdateTranslations.updateId,
        rows.map((row) => row.id),
      ),
    )

  return rows.map((row) => {
    const picked = pickTranslation(
      translations.filter((translation) => translation.updateId === row.id),
      locale,
    )

    return {
      happenedOn: row.happenedOn,
      title: picked?.title ?? '',
      body: picked?.body ?? '',
    }
  })
}

/** Title of a water point in the adopter's language, for the email subject. */
export async function projectTitleFor(projectId: string, locale: Locale) {
  const rows = await db
    .select()
    .from(projectTranslations)
    .where(eq(projectTranslations.projectId, projectId))

  const picked = pickTranslation(rows, locale)
  return picked ? { title: picked.title, slug: picked.slug } : null
}

/** Every adoption, for the admin screen. */
export async function adminListAdoptions() {
  return db.select().from(wellAdoptions).orderBy(desc(wellAdoptions.startedOn)).limit(300)
}
