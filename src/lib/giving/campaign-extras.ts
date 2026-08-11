import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { campaignMilestoneTranslations, campaignMilestones } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { pickTranslation } from '@/lib/content/translations'
import type { MilestoneInput } from '@/lib/giving/milestones'

/** Milestones of a campaign, in the reader's language. */
export async function listMilestones(
  campaignId: string,
  locale: Locale,
): Promise<MilestoneInput[]> {
  const rows = await db
    .select()
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, campaignId))
    .orderBy(asc(campaignMilestones.thresholdMinor))

  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(campaignMilestoneTranslations)
    .where(
      inArray(
        campaignMilestoneTranslations.milestoneId,
        rows.map((row) => row.id),
      ),
    )

  return rows.map((row) => {
    const picked = pickTranslation(
      translations.filter((translation) => translation.milestoneId === row.id),
      locale,
    )

    return {
      id: row.id,
      thresholdMinor: row.thresholdMinor,
      label: picked?.label || '',
      description: picked?.description || '',
    }
  })
  // A milestone with no label in any language would render as an empty row,
  // which reads as a bug rather than as a step still being written.
  .filter((milestone) => milestone.label.trim().length > 0)
}

/** Milestones with every language, for the admin editor. */
export async function adminListMilestones(campaignId: string) {
  const rows = await db
    .select()
    .from(campaignMilestones)
    .where(eq(campaignMilestones.campaignId, campaignId))
    .orderBy(asc(campaignMilestones.thresholdMinor))

  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(campaignMilestoneTranslations)
    .where(
      inArray(
        campaignMilestoneTranslations.milestoneId,
        rows.map((row) => row.id),
      ),
    )

  return rows.map((row) => ({
    ...row,
    translations: translations.filter((translation) => translation.milestoneId === row.id),
  }))
}
