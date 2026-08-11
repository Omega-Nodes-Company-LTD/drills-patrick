import 'server-only'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  impactIndicatorTranslations,
  impactIndicators,
  projectDocuments,
  projectTranslations,
  projects,
  spendingEntries,
  spendingEntryTranslations,
  waterPointReadings,
} from '@/db/schema'
import { pickTranslation } from '@/lib/content/translations'
import type { Locale } from '@/i18n/config'

/**
 * The public record: every water point, every reading, every figure and where
 * the money went.
 *
 * Nothing here is filtered by who is asking, because that is the point — the
 * register is the same for a funder, a journalist and the district water
 * officer. Only publication status is respected.
 */

export type RegistryRow = {
  id: string
  slug: string
  title: string
  status: string
  waterPointType: string
  country: string
  region: string | null
  district: string | null
  village: string | null
  latitude: number | null
  longitude: number | null
  wellsCount: number
  depthMeters: number | null
  yieldLitersPerHour: number | null
  beneficiaries: number
  completionDate: string | null
  /** Most recent measured yield, which may differ from the drilling figure. */
  latestYield: { value: number | null; measuredOn: string } | null
  /** Public water-quality certificates attached to this water point. */
  certificates: { id: string; title: string; issuedOn: string | null; mediaId: string | null }[]
}

export async function listRegistry(locale: Locale): Promise<RegistryRow[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.publishStatus, 'published'))
    .orderBy(desc(projects.completionDate), asc(projects.district))

  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)

  const [translations, readings, certificates] = await Promise.all([
    db.select().from(projectTranslations).where(inArray(projectTranslations.projectId, ids)),
    db
      .select()
      .from(waterPointReadings)
      .where(inArray(waterPointReadings.projectId, ids))
      .orderBy(desc(waterPointReadings.measuredOn)),
    db
      .select()
      .from(projectDocuments)
      .where(
        and(
          inArray(projectDocuments.projectId, ids),
          eq(projectDocuments.isPublic, true),
          eq(projectDocuments.kind, 'water_quality'),
        ),
      )
      .orderBy(desc(projectDocuments.issuedOn)),
  ])

  // Readings arrive newest first, so the first one seen per project is the
  // latest.
  const latest = new Map<string, (typeof readings)[number]>()
  for (const reading of readings) {
    if (!latest.has(reading.projectId)) latest.set(reading.projectId, reading)
  }

  return rows.map((row) => {
    const translation = pickTranslation(
      translations.filter((entry) => entry.projectId === row.id),
      locale,
    )
    const reading = latest.get(row.id)

    return {
      id: row.id,
      slug: translation?.slug ?? row.id,
      title: translation?.title ?? '—',
      status: row.status,
      waterPointType: row.waterPointType,
      country: row.country,
      region: row.region,
      district: row.district,
      village: row.village,
      latitude: row.latitude,
      longitude: row.longitude,
      wellsCount: row.wellsCount,
      depthMeters: row.depthMeters,
      yieldLitersPerHour: row.yieldLitersPerHour,
      beneficiaries: row.beneficiaries,
      completionDate: row.completionDate,
      latestYield: reading
        ? { value: reading.yieldLitersPerHour, measuredOn: reading.measuredOn }
        : null,
      certificates: certificates
        .filter((certificate) => certificate.projectId === row.id)
        .map((certificate) => ({
          id: certificate.id,
          title: certificate.title,
          issuedOn: certificate.issuedOn,
          mediaId: certificate.mediaId,
        })),
    }
  })
}

/** The readings for one water point, oldest first so a chart reads left to right. */
export async function listReadings(projectId: string) {
  return db
    .select()
    .from(waterPointReadings)
    .where(eq(waterPointReadings.projectId, projectId))
    .orderBy(asc(waterPointReadings.measuredOn))
}

export type PublicIndicator = {
  id: string
  key: string
  label: string
  value: string
  unit: string | null
  methodology: string
  source: string | null
  verifiedOn: string | null
}

export async function listIndicators(locale: Locale): Promise<PublicIndicator[]> {
  const [rows, translations] = await Promise.all([
    db.select().from(impactIndicators).orderBy(asc(impactIndicators.sortOrder)),
    db.select().from(impactIndicatorTranslations),
  ])

  return rows.map((row) => {
    const translation = pickTranslation(
      translations.filter((entry) => entry.indicatorId === row.id),
      locale,
    )

    return {
      id: row.id,
      key: row.key,
      label: translation?.label || row.key,
      value: row.value,
      unit: row.unit,
      // The translated method wins, but the untranslated one is better than
      // an indicator that silently loses its justification in one language.
      methodology: translation?.methodology || row.methodology,
      source: row.source,
      verifiedOn: row.verifiedOn,
    }
  })
}

export type SpendingYear = {
  year: number
  currency: string
  totalMinor: number
  categories: { label: string; amountMinor: number; share: number; note: string | null }[]
}

export async function listSpending(locale: Locale): Promise<SpendingYear[]> {
  const [rows, translations] = await Promise.all([
    db
      .select()
      .from(spendingEntries)
      .orderBy(desc(spendingEntries.year), asc(spendingEntries.sortOrder)),
    db.select().from(spendingEntryTranslations),
  ])

  const byYear = new Map<number, typeof rows>()
  for (const row of rows) {
    const list = byYear.get(row.year)
    if (list) list.push(row)
    else byYear.set(row.year, [row])
  }

  return [...byYear.entries()].map(([year, entries]) => {
    const totalMinor = entries.reduce((total, entry) => total + entry.amountMinor, 0)

    return {
      year,
      currency: entries[0]?.currency ?? 'EUR',
      totalMinor,
      categories: entries.map((entry) => {
        const translation = pickTranslation(
          translations.filter((row) => row.entryId === entry.id),
          locale,
        )

        return {
          label: translation?.label || entry.category,
          amountMinor: entry.amountMinor,
          // Guarded: a year with everything at zero must not divide by zero.
          share: totalMinor > 0 ? entry.amountMinor / totalMinor : 0,
          note: entry.note,
        }
      }),
    }
  })
}
