import 'server-only'
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  campaignTranslations,
  donations,
  projectTranslations,
  recurringPlans,
} from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { pickTranslation } from '@/lib/content/translations'
import { tokenMatches } from '@/lib/giving/tokens'

/**
 * A donor's own record of what they gave.
 *
 * Reached with the same link that manages their standing gift, because
 * building a second account system for one page would be worse for everyone.
 * It states plainly that it is not a tax document: what counts as one differs
 * by country, and quietly implying otherwise would be the harmful default.
 */

export type StatementLine = {
  reference: string
  date: string
  amountMinor: number
  currency: string
  designation: string | null
}

export type Statement = {
  donorName: string | null
  donorEmail: string
  year: number
  totalMinor: number
  currency: string
  lines: StatementLine[]
  /** Years that actually have gifts, so the picker never offers an empty one. */
  years: number[]
}

/** Resolves the plan behind a manage token, without leaking which refs exist. */
export async function planByToken(reference: string, token: string) {
  const [plan] = await db
    .select()
    .from(recurringPlans)
    .where(eq(recurringPlans.reference, reference))
    .limit(1)

  if (!plan) return null
  return tokenMatches(token, plan.manageTokenHash) ? plan : null
}

/**
 * Every succeeded gift on an email address in a year.
 *
 * Matched by email because that is the only identifier a donor without an
 * account has. Gifts given anonymously are still listed: anonymity is about
 * what the public sees, not about hiding someone's own record from them.
 */
export async function buildStatement(params: {
  email: string
  year: number
  locale: Locale
}): Promise<Statement> {
  const email = params.email.toLowerCase()
  const from = new Date(Date.UTC(params.year, 0, 1))
  const to = new Date(Date.UTC(params.year + 1, 0, 1))

  const [rows, years] = await Promise.all([
    db
      .select()
      .from(donations)
      .where(
        and(
          eq(donations.donorEmail, email),
          eq(donations.status, 'succeeded'),
          gte(donations.createdAt, from),
          lte(donations.createdAt, to),
        ),
      )
      .orderBy(asc(donations.createdAt)),
    db
      .select({ year: sql<number>`extract(year from ${donations.createdAt})::int` })
      .from(donations)
      .where(and(eq(donations.donorEmail, email), eq(donations.status, 'succeeded')))
      .groupBy(sql`extract(year from ${donations.createdAt})`)
      .orderBy(sql`extract(year from ${donations.createdAt}) desc`),
  ])

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
      ? db
          .select()
          .from(projectTranslations)
          .where(inArray(projectTranslations.projectId, projectIds))
      : Promise.resolve([]),
  ])

  const designationOf = (row: (typeof rows)[number]): string | null => {
    if (row.campaignId) {
      return (
        pickTranslation(
          campaignRows.filter((translation) => translation.campaignId === row.campaignId),
          params.locale,
        )?.title ?? null
      )
    }
    if (row.projectId) {
      return (
        pickTranslation(
          projectRows.filter((translation) => translation.projectId === row.projectId),
          params.locale,
        )?.title ?? null
      )
    }
    return null
  }

  const lines = rows.map((row) => ({
    reference: row.receiptNumber ?? row.reference,
    date: row.createdAt.toISOString().slice(0, 10),
    amountMinor: row.amountMinor,
    currency: row.currency,
    designation: designationOf(row),
  }))

  // Totalled per currency would be honest but unreadable; the common case is
  // one currency, and a donor who used two sees the total for the one they
  // used most rather than a sum of unlike things.
  const byCurrency = new Map<string, number>()
  for (const line of lines) {
    byCurrency.set(line.currency, (byCurrency.get(line.currency) ?? 0) + line.amountMinor)
  }
  const [dominant] = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])

  return {
    donorName: rows.find((row) => row.donorName)?.donorName ?? null,
    donorEmail: email,
    year: params.year,
    totalMinor: dominant?.[1] ?? 0,
    currency: dominant?.[0] ?? 'EUR',
    lines,
    years: years.map((row) => row.year),
  }
}
