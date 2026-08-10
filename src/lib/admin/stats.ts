import 'server-only'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  campaigns,
  donations,
  ngoInquiries,
  posts,
  projects,
} from '@/db/schema'

/** Numbers shown on the admin dashboard. */
export async function dashboardStats() {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    [totals],
    [monthTotals],
    [pending],
    [activeCampaigns],
    [projectCounts],
    [inquiryCount],
    [draftCount],
  ] = await Promise.all([
    db
      .select({
        amount: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
        currency: sql<string>`coalesce(min(${donations.currency}), 'EUR')`,
      })
      .from(donations)
      .where(eq(donations.status, 'succeeded')),
    db
      .select({ amount: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::bigint` })
      .from(donations)
      .where(and(eq(donations.status, 'succeeded'), gte(donations.confirmedAt, monthStart))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(donations)
      .where(sql`${donations.status} in ('pending', 'processing')`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(eq(campaigns.status, 'published')),
    db
      .select({
        completed: sql<number>`count(*) filter (where ${projects.status} = 'completed')::int`,
        inProgress: sql<number>`count(*) filter (where ${projects.status} = 'in_progress')::int`,
        planned: sql<number>`count(*) filter (where ${projects.status} = 'planned')::int`,
        beneficiaries: sql<number>`coalesce(sum(${projects.beneficiaries}), 0)::int`,
      })
      .from(projects)
      .where(eq(projects.publishStatus, 'published')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ngoInquiries)
      .where(eq(ngoInquiries.status, 'new')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.status, 'draft')),
  ])

  return {
    raisedTotal: Number(totals?.amount ?? 0),
    raisedThisMonth: Number(monthTotals?.amount ?? 0),
    donationsCount: totals?.count ?? 0,
    currency: totals?.currency ?? 'EUR',
    pendingDonations: pending?.count ?? 0,
    activeCampaigns: activeCampaigns?.count ?? 0,
    projectsCompleted: projectCounts?.completed ?? 0,
    projectsInProgress: projectCounts?.inProgress ?? 0,
    projectsPlanned: projectCounts?.planned ?? 0,
    beneficiaries: projectCounts?.beneficiaries ?? 0,
    newInquiries: inquiryCount?.count ?? 0,
    drafts: draftCount?.count ?? 0,
  }
}

export async function recentDonations(limit = 6) {
  return db
    .select({
      id: donations.id,
      reference: donations.reference,
      donorName: donations.donorName,
      donorOrganisation: donations.donorOrganisation,
      isAnonymous: donations.isAnonymous,
      amountMinor: donations.amountMinor,
      currency: donations.currency,
      status: donations.status,
      provider: donations.provider,
      createdAt: donations.createdAt,
    })
    .from(donations)
    .orderBy(desc(donations.createdAt))
    .limit(limit)
}
