import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  contractProjects,
  faultReports,
  maintenanceContracts,
  maintenanceVisits,
  partnerProjects,
  projectDocuments,
  projectTranslations,
  projects,
  type MediaRow,
} from '@/db/schema'
import { pickTranslation } from '@/lib/content/translations'
import { getMediaByIds } from '@/lib/media/service'
import type { Locale } from '@/i18n/config'

/**
 * Read models for the partner portal.
 *
 * Every query starts from the partner id in the session and narrows to the
 * projects that partner is linked to. There is no "all projects" call here on
 * purpose: an accidental missing filter in a page would otherwise show one
 * NGO another NGO's documents, and that is the failure this whole area exists
 * to avoid.
 */

/** Project ids this partner may see. Empty means the portal shows nothing. */
export async function partnerProjectIds(partnerId: string): Promise<string[]> {
  const rows = await db
    .select({ projectId: partnerProjects.projectId })
    .from(partnerProjects)
    .where(eq(partnerProjects.partnerId, partnerId))

  return rows.map((row) => row.projectId)
}

export type PortalProject = {
  id: string
  title: string
  slug: string
  status: string
  district: string | null
  village: string | null
  beneficiaries: number
  completionDate: string | null
  cover: MediaRow | null
  documentCount: number
  openFaults: number
}

export async function listPortalProjects(
  partnerId: string,
  locale: Locale,
): Promise<PortalProject[]> {
  const ids = await partnerProjectIds(partnerId)
  if (ids.length === 0) return []

  const [rows, translations, documents, faults] = await Promise.all([
    db.select().from(projects).where(inArray(projects.id, ids)).orderBy(desc(projects.updatedAt)),
    db.select().from(projectTranslations).where(inArray(projectTranslations.projectId, ids)),
    db
      .select({ projectId: projectDocuments.projectId })
      .from(projectDocuments)
      .where(inArray(projectDocuments.projectId, ids)),
    db
      .select({ projectId: faultReports.projectId, status: faultReports.status })
      .from(faultReports)
      .where(inArray(faultReports.projectId, ids)),
  ])

  const covers = await getMediaByIds(rows.map((row) => row.coverId).filter(Boolean) as string[])

  const documentCounts = new Map<string, number>()
  for (const row of documents) {
    documentCounts.set(row.projectId, (documentCounts.get(row.projectId) ?? 0) + 1)
  }

  const openFaults = new Map<string, number>()
  for (const row of faults) {
    if (row.status === 'resolved' || row.status === 'closed') continue
    openFaults.set(row.projectId, (openFaults.get(row.projectId) ?? 0) + 1)
  }

  const byProject = new Map<string, typeof translations>()
  for (const row of translations) {
    const list = byProject.get(row.projectId)
    if (list) list.push(row)
    else byProject.set(row.projectId, [row])
  }

  return rows.map((row) => {
    const translation = pickTranslation(byProject.get(row.id), locale)

    return {
      id: row.id,
      title: translation?.title ?? '—',
      slug: translation?.slug ?? row.id,
      status: row.status,
      district: row.district,
      village: row.village,
      beneficiaries: row.beneficiaries,
      completionDate: row.completionDate,
      cover: row.coverId ? (covers.get(row.coverId) ?? null) : null,
      documentCount: documentCounts.get(row.id) ?? 0,
      openFaults: openFaults.get(row.id) ?? 0,
    }
  })
}

export type PortalDocument = {
  id: string
  projectId: string
  projectTitle: string
  kind: string
  title: string
  description: string | null
  issuedOn: string | null
  expiresOn: string | null
  file: MediaRow | null
}

/** Documents on the partner's projects, newest first. */
export async function listPortalDocuments(
  partnerId: string,
  locale: Locale,
  filters: { projectId?: string; kind?: string } = {},
): Promise<PortalDocument[]> {
  const ids = await partnerProjectIds(partnerId)
  if (ids.length === 0) return []

  // A project id from the query string is intersected with the allowed set
  // rather than trusted, so a guessed id returns nothing instead of a leak.
  const scope = filters.projectId
    ? ids.filter((id) => id === filters.projectId)
    : ids
  if (scope.length === 0) return []

  const conditions = [inArray(projectDocuments.projectId, scope)]
  if (filters.kind) {
    conditions.push(eq(projectDocuments.kind, filters.kind as 'other'))
  }

  const [rows, translations] = await Promise.all([
    db
      .select()
      .from(projectDocuments)
      .where(and(...conditions))
      .orderBy(desc(projectDocuments.issuedOn), desc(projectDocuments.createdAt)),
    db.select().from(projectTranslations).where(inArray(projectTranslations.projectId, scope)),
  ])

  const files = await getMediaByIds(rows.map((row) => row.mediaId).filter(Boolean) as string[])

  const titles = new Map<string, string>()
  for (const id of scope) {
    const forProject = translations.filter((row) => row.projectId === id)
    titles.set(id, pickTranslation(forProject, locale)?.title ?? '—')
  }

  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    projectTitle: titles.get(row.projectId) ?? '—',
    kind: row.kind,
    title: row.title,
    description: row.description,
    issuedOn: row.issuedOn,
    expiresOn: row.expiresOn,
    file: row.mediaId ? (files.get(row.mediaId) ?? null) : null,
  }))
}

/** Maintenance contracts held by this partner, with their covered projects. */
export async function listPortalContracts(partnerId: string) {
  const contracts = await db
    .select()
    .from(maintenanceContracts)
    .where(eq(maintenanceContracts.partnerId, partnerId))
    .orderBy(desc(maintenanceContracts.startsOn))

  if (contracts.length === 0) return []

  const covered = await db
    .select()
    .from(contractProjects)
    .where(
      inArray(
        contractProjects.contractId,
        contracts.map((row) => row.id),
      ),
    )

  const visits = await db
    .select()
    .from(maintenanceVisits)
    .where(
      inArray(
        maintenanceVisits.contractId,
        contracts.map((row) => row.id),
      ),
    )
    .orderBy(desc(maintenanceVisits.visitedOn))

  return contracts.map((contract) => {
    const contractVisits = visits.filter((visit) => visit.contractId === contract.id)
    const lastVisit = contractVisits[0]?.visitedOn ?? null

    return {
      ...contract,
      projectCount: covered.filter((row) => row.contractId === contract.id).length,
      visitCount: contractVisits.length,
      lastVisit,
      nextVisitDue: nextVisitDue(lastVisit ?? contract.startsOn, contract.visitIntervalMonths),
    }
  })
}

/** The date the next scheduled visit falls due, as an ISO date string. */
export function nextVisitDue(from: string, intervalMonths: number): string {
  const date = new Date(`${from}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + intervalMonths)
  return date.toISOString().slice(0, 10)
}
