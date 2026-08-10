import { desc, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  maintenanceVisits,
  partnerProjects,
  partners,
  projectTranslations,
  projects,
} from '@/db/schema'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { requireApiUser } from '@/lib/auth/guard'
import { pickTranslation } from '@/lib/content/translations'
import { fromMinorUnits } from '@/lib/money'

export const dynamic = 'force-dynamic'

/**
 * Project data as a flat CSV, in the shape institutional donors ask for.
 *
 * Every reporting cycle, somebody retypes the same figures into a template
 * sent by a funder. The columns here are the ones those templates share —
 * identifier, title, location down to district, dates, budget and currency,
 * beneficiaries disaggregated as far as the data allows, and the current
 * operational status — with an ISO date and a machine-readable status rather
 * than prose, because that is what gets pasted into a grant report.
 *
 * A CSV rather than a bespoke XML: it opens in the spreadsheet the officer is
 * already using, and every donor portal accepts one.
 */

const COLUMNS = [
  'project_id',
  'title',
  'country',
  'region',
  'district',
  'village',
  'latitude',
  'longitude',
  'water_point_type',
  'status',
  'wells_count',
  'depth_m',
  'yield_l_per_hour',
  'beneficiaries',
  'households',
  'schools_served',
  'health_facilities_served',
  'start_date',
  'completion_date',
  'planned_completion_date',
  'budget_amount',
  'funded_amount',
  'currency',
  'last_visit_date',
  'functional_at_last_visit',
  'partners',
] as const

/** RFC 4180: quote everything, double the quotes inside. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const user = await requireApiUser('projects')
  if (!user) return new Response('Unauthorised', { status: 401 })

  const url = new URL(request.url)
  const requested = url.searchParams.get('locale') ?? defaultLocale
  const locale = ((locales as readonly string[]).includes(requested)
    ? requested
    : defaultLocale) as Locale

  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt))

  if (rows.length === 0) {
    return new Response(COLUMNS.join(',') + '\n', {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  }

  const ids = rows.map((row) => row.id)

  const [translations, visits, links, partnerRows] = await Promise.all([
    db.select().from(projectTranslations).where(inArray(projectTranslations.projectId, ids)),
    db
      .select()
      .from(maintenanceVisits)
      .where(inArray(maintenanceVisits.projectId, ids))
      .orderBy(desc(maintenanceVisits.visitedOn)),
    db.select().from(partnerProjects).where(inArray(partnerProjects.projectId, ids)),
    db.select({ id: partners.id, name: partners.name }).from(partners),
  ])

  const partnerNames = new Map(partnerRows.map((row) => [row.id, row.name]))

  const latestVisit = new Map<string, (typeof visits)[number]>()
  for (const visit of visits) {
    if (!latestVisit.has(visit.projectId)) latestVisit.set(visit.projectId, visit)
  }

  const lines = rows.map((row) => {
    const translation = pickTranslation(
      translations.filter((entry) => entry.projectId === row.id),
      locale,
    )
    const visit = latestVisit.get(row.id)

    return [
      row.id,
      translation?.title ?? '',
      row.country,
      row.region,
      row.district,
      row.village,
      row.latitude,
      row.longitude,
      row.waterPointType,
      row.status,
      row.wellsCount,
      row.depthMeters,
      row.yieldLitersPerHour,
      row.beneficiaries,
      row.households,
      row.schoolsServed,
      row.healthFacilitiesServed,
      row.startDate,
      row.completionDate,
      row.plannedCompletionDate,
      row.budgetAmount != null ? fromMinorUnits(row.budgetAmount, row.currency) : null,
      fromMinorUnits(row.fundedAmount, row.currency),
      row.currency,
      visit?.visitedOn ?? null,
      // Blank rather than "false" when nobody has visited: an unverified water
      // point is not the same claim as a broken one.
      visit ? (visit.functionalAfter ? 'yes' : 'no') : null,
      links
        .filter((link) => link.projectId === row.id)
        .map((link) => partnerNames.get(link.partnerId) ?? '')
        .filter(Boolean)
        .join('; '),
    ]
      .map(cell)
      .join(',')
  })

  const csv = [COLUMNS.join(','), ...lines].join('\n') + '\n'
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="projects-${stamp}.csv"`,
    },
  })
}
