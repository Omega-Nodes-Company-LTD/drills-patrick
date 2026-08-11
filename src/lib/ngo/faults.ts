import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { faultReports, maintenanceVisits, projectTranslations, projects } from '@/db/schema'
import { pickTranslation } from '@/lib/content/translations'
import type { Locale } from '@/i18n/config'

/**
 * Faults reported from the field, and what they say about the service.
 *
 * A borehole that stops working is the failure mode that matters: a
 * non-functional water point is worse than no water point, because the
 * community walked away from its old source. Everything here exists to make
 * that visible rather than discovered on the next visit.
 */

/** Short human reference, quotable over the phone. */
export function faultReference(): string {
  const stamp = Date.now().toString(36).toUpperCase()
  return `F-${stamp.slice(-6)}`
}

export type SlaMetrics = {
  /** Faults opened in the window. */
  reported: number
  resolved: number
  open: number
  /** Median hours from report to acknowledgement, null when nothing to measure. */
  medianAcknowledgeHours: number | null
  /** Median hours from report to resolution. */
  medianResolveHours: number | null
  /** Share of covered water points working at the last visit, 0–1. */
  functionalRate: number | null
}

/** Exported for tests: the choice of median over mean is the point, so pin it. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

const HOURS = 1000 * 60 * 60

/**
 * Service figures over a window.
 *
 * Medians rather than means: one borehole in a district cut off by rain for
 * three weeks would drag an average far enough to make the number useless,
 * and the question being asked is "how long does this usually take".
 */
export async function slaMetrics(params: {
  projectIds?: string[]
  sinceDays?: number
}): Promise<SlaMetrics> {
  const since = new Date(Date.now() - (params.sinceDays ?? 365) * 24 * HOURS)

  const conditions = [gte(faultReports.createdAt, since)]
  if (params.projectIds) {
    if (params.projectIds.length === 0) {
      return {
        reported: 0,
        resolved: 0,
        open: 0,
        medianAcknowledgeHours: null,
        medianResolveHours: null,
        functionalRate: null,
      }
    }
    conditions.push(inArray(faultReports.projectId, params.projectIds))
  }

  const faults = await db
    .select()
    .from(faultReports)
    .where(and(...conditions))

  const acknowledgeHours = faults
    .filter((fault) => fault.acknowledgedAt)
    .map((fault) => (fault.acknowledgedAt!.getTime() - fault.createdAt.getTime()) / HOURS)

  const resolveHours = faults
    .filter((fault) => fault.resolvedAt)
    .map((fault) => (fault.resolvedAt!.getTime() - fault.createdAt.getTime()) / HOURS)

  // Functionality is taken from the most recent visit to each water point:
  // the last time anyone actually looked is the only honest source.
  const visitConditions = params.projectIds
    ? [inArray(maintenanceVisits.projectId, params.projectIds)]
    : []

  const visits = await db
    .select()
    .from(maintenanceVisits)
    .where(visitConditions.length > 0 ? and(...visitConditions) : undefined)
    .orderBy(desc(maintenanceVisits.visitedOn))

  const latestByProject = new Map<string, boolean>()
  for (const visit of visits) {
    if (!latestByProject.has(visit.projectId)) {
      latestByProject.set(visit.projectId, visit.functionalAfter)
    }
  }

  const working = [...latestByProject.values()].filter(Boolean).length

  return {
    reported: faults.length,
    resolved: faults.filter((fault) => fault.status === 'resolved' || fault.status === 'closed')
      .length,
    open: faults.filter((fault) => fault.status !== 'resolved' && fault.status !== 'closed').length,
    medianAcknowledgeHours: median(acknowledgeHours),
    medianResolveHours: median(resolveHours),
    functionalRate: latestByProject.size > 0 ? working / latestByProject.size : null,
  }
}

/** Faults with the project they belong to, for the admin and the portal. */
export async function listFaults(params: {
  projectIds?: string[]
  locale: Locale
  openOnly?: boolean
  limit?: number
}) {
  const conditions = []
  if (params.projectIds) {
    if (params.projectIds.length === 0) return []
    conditions.push(inArray(faultReports.projectId, params.projectIds))
  }
  if (params.openOnly) conditions.push(isNotNull(faultReports.id))

  const rows = await db
    .select()
    .from(faultReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(faultReports.createdAt))
    .limit(params.limit ?? 200)

  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(projectTranslations)
    .where(
      inArray(
        projectTranslations.projectId,
        rows.map((row) => row.projectId),
      ),
    )

  const titles = new Map<string, string>()
  for (const row of rows) {
    if (titles.has(row.projectId)) continue
    const forProject = translations.filter((entry) => entry.projectId === row.projectId)
    titles.set(row.projectId, pickTranslation(forProject, params.locale)?.title ?? '—')
  }

  return rows
    .filter((row) => !params.openOnly || (row.status !== 'resolved' && row.status !== 'closed'))
    .map((row) => ({ ...row, projectTitle: titles.get(row.projectId) ?? '—' }))
}

/** The project a QR sticker points at, resolved from its public slug. */
export async function projectForFaultReport(slug: string, locale: Locale) {
  const [translation] = await db
    .select()
    .from(projectTranslations)
    .where(eq(projectTranslations.slug, slug))
    .limit(1)

  if (!translation) return null

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, translation.projectId), eq(projects.publishStatus, 'published')))
    .limit(1)

  if (!project) return null

  const all = await db
    .select()
    .from(projectTranslations)
    .where(eq(projectTranslations.projectId, project.id))

  return { project, title: pickTranslation(all, locale)?.title ?? '—' }
}
