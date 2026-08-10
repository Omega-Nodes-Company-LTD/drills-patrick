import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { listProjects } from '@/lib/content/queries'
import { localeUrl } from '@/lib/seo'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'

/**
 * Every published water point, as data.
 *
 * The site's whole argument rests on numbers — wells drilled, people served,
 * depth, yield — and a number inside a rendered page is a claim nobody can
 * check at scale. This endpoint is the same figures in a form a partner NGO,
 * a journalist or an answer engine can read, count and cite, with the licence
 * stated in the payload so reuse does not need a lawyer.
 *
 * Deliberately not paginated on a cursor: the whole set is small enough to
 * hand over at once, and a caller that has to reassemble pages usually gives
 * up instead.
 */

const MAX = 1000

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requested = url.searchParams.get('locale') ?? defaultLocale
  const locale = ((locales as readonly string[]).includes(requested)
    ? requested
    : defaultLocale) as Locale

  const settings = await getSiteSettings()
  const { items, total } = await listProjects({ locale, limit: MAX })

  const body = {
    '@context': 'https://schema.org',
    generatedAt: new Date().toISOString(),
    publisher: {
      name: settings.siteName,
      url: localeUrl(locale, '/'),
      registrationNumber: settings.organisation.registrationNumber ?? null,
    },
    licence: {
      name: settings.seo.contentLicence ?? null,
      url: settings.seo.contentLicenceUrl ?? null,
      // Stated rather than implied: a consumer that finds no licence has to
      // assume the strictest terms, which makes the data useless to them.
      note: settings.seo.contentLicence
        ? `Reuse permitted under ${settings.seo.contentLicence}, attributing ${settings.siteName}.`
        : 'No licence stated. Contact the publisher before reuse.',
    },
    locale,
    count: items.length,
    total,
    projects: items.map((project) => ({
      id: project.id,
      url: localeUrl(locale, `/projects/${project.slug}`),
      title: project.title,
      summary: project.summary,
      status: project.status,
      waterPointType: project.waterPointType,
      location: {
        country: project.country,
        region: project.region,
        district: project.district,
        village: project.village,
        latitude: project.latitude,
        longitude: project.longitude,
      },
      wellsCount: project.wellsCount,
      depthMeters: project.depthMeters,
      beneficiaries: project.beneficiaries,
      completionDate: project.completionDate,
      plannedCompletionDate: project.plannedCompletionDate,
      image: mediaUrl(project.cover?.objectKey) || null,
    })),
  }

  return Response.json(body, {
    headers: {
      // Open by design: the point of publishing the data is that other sites
      // can read it directly.
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  })
}
