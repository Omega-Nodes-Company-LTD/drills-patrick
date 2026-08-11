import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { listRegistry } from '@/lib/transparency/registry'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

/**
 * The register as a spreadsheet.
 *
 * The JSON endpoint is for software; this is for the person who will open it
 * in Excel and sort by district. Same rows, no key required, and the licence
 * stated in a comment line so it travels with the file when it is emailed on.
 */

const COLUMNS = [
  'id',
  'name',
  'country',
  'region',
  'district',
  'village',
  'latitude',
  'longitude',
  'type',
  'status',
  'water_points',
  'depth_m',
  'yield_l_per_hour',
  'yield_measured_on',
  'people_served',
  'completed_on',
  'water_quality_certificates',
] as const

const cell = (value: unknown) =>
  value === null || value === undefined ? '""' : `"${String(value).replace(/"/g, '""')}"`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requested = url.searchParams.get('locale') ?? defaultLocale
  const locale = ((locales as readonly string[]).includes(requested)
    ? requested
    : defaultLocale) as Locale

  const [settings, rows] = await Promise.all([getSiteSettings(), listRegistry(locale)])

  const licence = settings.seo.contentLicence
    ? `# Licence: ${settings.seo.contentLicence}. Attribution: ${settings.siteName}.`
    : `# Licence: not stated. Contact ${settings.contact.email ?? settings.siteName} before reuse.`

  const lines = rows.map((row) =>
    [
      row.id,
      row.title,
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
      // The measured figure, falling back to the drilling-day one, with the
      // date alongside so the two are never confused.
      row.latestYield?.value ?? row.yieldLitersPerHour,
      row.latestYield?.measuredOn ?? null,
      row.beneficiaries,
      row.completionDate,
      row.certificates.length,
    ]
      .map(cell)
      .join(','),
  )

  const csv = [licence, COLUMNS.join(','), ...lines].join('\n') + '\n'
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="water-points-${stamp}.csv"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  })
}
