import 'server-only'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { donations } from '@/db/schema'

/**
 * The public supporter wall.
 *
 * Only gifts whose donor ticked the box appear, and only ever the name — never
 * the amount. Publishing what someone gave turns a wall of thanks into a
 * league table, and the people who give least relative to their means come off
 * worst in it.
 */

export type WallEntry = {
  name: string
  /** How many times they have given; the only number shown. */
  gifts: number
  latestAt: Date
}

export async function listSupporterWall(params?: {
  sinceYear?: number
  limit?: number
}): Promise<WallEntry[]> {
  const conditions = [eq(donations.status, 'succeeded'), eq(donations.showOnWall, true)]

  if (params?.sinceYear) {
    conditions.push(gte(donations.createdAt, new Date(Date.UTC(params.sinceYear, 0, 1))))
  }

  const rows = await db
    .select({
      // The chosen display name wins over the billing name: someone giving as
      // "the Okello family" asked for that, and their bank name is not it.
      name: sql<string>`coalesce(nullif(trim(${donations.wallDisplayName}), ''), nullif(trim(${donations.donorName}), ''))`,
      gifts: sql<number>`count(*)::int`,
      latestAt: sql<Date>`max(${donations.createdAt})`,
    })
    .from(donations)
    .where(and(...conditions))
    .groupBy(
      sql`coalesce(nullif(trim(${donations.wallDisplayName}), ''), nullif(trim(${donations.donorName}), ''))`,
    )
    .orderBy(desc(sql`max(${donations.createdAt})`))
    .limit(params?.limit ?? 500)

  // A gift with the box ticked but no name at all has nothing to show; it is
  // dropped rather than listed as "Anonymous", which would be a name they did
  // not choose either.
  return rows.filter((row) => Boolean(row.name?.trim()))
}

/** Years that actually have entries, for the wall's own filter. */
export async function wallYears(): Promise<number[]> {
  const rows = await db
    .select({ year: sql<number>`extract(year from ${donations.createdAt})::int` })
    .from(donations)
    .where(and(eq(donations.status, 'succeeded'), eq(donations.showOnWall, true)))
    .groupBy(sql`extract(year from ${donations.createdAt})`)
    .orderBy(desc(sql`extract(year from ${donations.createdAt})`))

  return rows.map((row) => row.year)
}
