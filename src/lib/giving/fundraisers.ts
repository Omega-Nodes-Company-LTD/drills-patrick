import 'server-only'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  campaignTranslations,
  donations,
  fundraiserDonations,
  fundraisers,
  projectTranslations,
} from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { pickTranslation } from '@/lib/content/translations'
import { tokenMatches } from '@/lib/giving/tokens'
import { slugify } from '@/lib/utils'

/**
 * Pages supporters run on the organisation's behalf.
 *
 * Only approved pages are ever public. These carry the organisation's name and
 * are written by people it has no contract with, so one going live unread is a
 * reputational risk that costs nothing to avoid.
 */

export type PublicFundraiser = {
  id: string
  slug: string
  ownerName: string
  title: string
  story: string
  coverId: string | null
  goalAmountMinor: number
  raisedAmountMinor: number
  currency: string
  endsOn: string | null
  causeTitle: string | null
  causeHref: string | null
  createdAt: Date
}

async function causeTitles(rows: (typeof fundraisers.$inferSelect)[], locale: Locale) {
  const campaignIds = [...new Set(rows.map((row) => row.campaignId).filter(Boolean))] as string[]
  const projectIds = [...new Set(rows.map((row) => row.projectId).filter(Boolean))] as string[]

  const [campaignRows, projectRows] = await Promise.all([
    campaignIds.length > 0
      ? db
          .select()
          .from(campaignTranslations)
          .where(inArray(campaignTranslations.campaignId, campaignIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.select().from(projectTranslations).where(inArray(projectTranslations.projectId, projectIds))
      : Promise.resolve([]),
  ])

  const campaigns = new Map<string, { title: string; slug: string }>()
  for (const id of campaignIds) {
    const picked = pickTranslation(
      campaignRows.filter((row) => row.campaignId === id),
      locale,
    )
    if (picked) campaigns.set(id, { title: picked.title, slug: picked.slug })
  }

  const projects = new Map<string, { title: string; slug: string }>()
  for (const id of projectIds) {
    const picked = pickTranslation(
      projectRows.filter((row) => row.projectId === id),
      locale,
    )
    if (picked) projects.set(id, { title: picked.title, slug: picked.slug })
  }

  return { campaigns, projects }
}

function present(
  row: typeof fundraisers.$inferSelect,
  causes: Awaited<ReturnType<typeof causeTitles>>,
): PublicFundraiser {
  const campaign = row.campaignId ? causes.campaigns.get(row.campaignId) : undefined
  const project = row.projectId ? causes.projects.get(row.projectId) : undefined
  const cause = campaign
    ? { title: campaign.title, href: `/campaigns/${campaign.slug}` }
    : project
      ? { title: project.title, href: `/projects/${project.slug}` }
      : null

  return {
    id: row.id,
    slug: row.slug,
    ownerName: row.ownerName,
    title: row.title,
    story: row.story,
    coverId: row.coverId,
    goalAmountMinor: row.goalAmountMinor,
    raisedAmountMinor: row.raisedAmountMinor,
    currency: row.currency,
    endsOn: row.endsOn,
    causeTitle: cause?.title ?? null,
    causeHref: cause?.href ?? null,
    createdAt: row.createdAt,
  }
}

export async function listFundraisers(locale: Locale, limit = 60): Promise<PublicFundraiser[]> {
  const rows = await db
    .select()
    .from(fundraisers)
    .where(eq(fundraisers.status, 'approved'))
    .orderBy(desc(fundraisers.raisedAmountMinor), desc(fundraisers.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  const causes = await causeTitles(rows, locale)
  return rows.map((row) => present(row, causes))
}

export async function getFundraiser(slug: string, locale: Locale): Promise<PublicFundraiser | null> {
  const [row] = await db
    .select()
    .from(fundraisers)
    .where(and(eq(fundraisers.slug, slug), eq(fundraisers.status, 'approved')))
    .limit(1)

  if (!row) return null

  const causes = await causeTitles([row], locale)
  return present(row, causes)
}

/**
 * Resolves the owner's management link.
 *
 * The slug narrows the search to one row before the token is checked, so a
 * caller cannot use this to scan for valid tokens. Unapproved pages are
 * included: the owner should be able to see and fix a page held for review.
 */
export async function getFundraiserByToken(slug: string, token: string) {
  const [row] = await db.select().from(fundraisers).where(eq(fundraisers.slug, slug)).limit(1)
  if (!row) return null
  return tokenMatches(token, row.manageTokenHash) ? row : null
}

/** Gifts that came in through a page, for the page's own list. */
export async function fundraiserSupporters(fundraiserId: string, limit = 50) {
  return db
    .select({
      id: donations.id,
      name: donations.donorName,
      displayName: donations.wallDisplayName,
      isAnonymous: donations.isAnonymous,
      amountMinor: donations.amountMinor,
      currency: donations.currency,
      message: donations.message,
      createdAt: donations.createdAt,
    })
    .from(fundraiserDonations)
    .innerJoin(donations, eq(donations.id, fundraiserDonations.donationId))
    .where(
      and(eq(fundraiserDonations.fundraiserId, fundraiserId), eq(donations.status, 'succeeded')),
    )
    .orderBy(desc(donations.createdAt))
    .limit(limit)
}

/**
 * Recomputes a page's total from the gifts that reached it.
 *
 * Derived rather than incremented: an increment that runs twice on a webhook
 * retry overstates the total, and the number on a fundraiser's page is one
 * they will check against what their friends told them they gave.
 */
export async function recomputeFundraiserTotal(fundraiserId: string): Promise<void> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::bigint`,
    })
    .from(fundraiserDonations)
    .innerJoin(donations, eq(donations.id, fundraiserDonations.donationId))
    .where(
      and(eq(fundraiserDonations.fundraiserId, fundraiserId), eq(donations.status, 'succeeded')),
    )

  await db
    .update(fundraisers)
    .set({ raisedAmountMinor: Number(row?.total ?? 0), updatedAt: new Date() })
    .where(eq(fundraisers.id, fundraiserId))
}

/**
 * A slug that is free.
 *
 * Two supporters called Anna running a marathon in the same month is not an
 * edge case, so a collision appends a counter rather than failing the form and
 * losing the volunteer.
 */
export async function uniqueFundraiserSlug(title: string, ownerName: string): Promise<string> {
  const base = slugify(title) || slugify(ownerName) || 'fundraiser'

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const [taken] = await db
      .select({ id: fundraisers.id })
      .from(fundraisers)
      .where(eq(fundraisers.slug, candidate))
      .limit(1)

    if (!taken) return candidate
  }

  // Fifty collisions on one title means something odd; a suffix ends it.
  return `${base}-${Date.now().toString(36)}`
}

/** Every page an admin may need to moderate, newest first. */
export async function adminListFundraisers() {
  return db.select().from(fundraisers).orderBy(desc(fundraisers.createdAt)).limit(200)
}
