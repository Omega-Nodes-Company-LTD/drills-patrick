import { count, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { projects } from '@/db/schema'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { formatNumber } from '@/lib/money'
import { localeUrl } from '@/lib/seo'
import { getActiveTheme, getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

/**
 * An SVG badge a partner can put on their own site.
 *
 * SVG rather than an iframe or a script: a partner's CMS will let them paste
 * an `<img>` and very often nothing else, it cannot execute anything on their
 * page, and it survives being screenshotted into a report. It carries the
 * figure and a link back, which is the whole trade — they get a live number,
 * the site gets a citation.
 *
 * Numbers come from published projects only, so the badge can never show a
 * figure the site itself does not stand behind.
 */

const WIDTH = 320
const HEIGHT = 120

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requested = url.searchParams.get('locale') ?? defaultLocale
  const locale = ((locales as readonly string[]).includes(requested)
    ? requested
    : defaultLocale) as Locale

  const metric = url.searchParams.get('metric') === 'wells' ? 'wells' : 'people'

  const [settings, theme, [totals]] = await Promise.all([
    getSiteSettings(),
    getActiveTheme().catch(() => null),
    db
      .select({
        people: sql<number>`coalesce(sum(${projects.beneficiaries}), 0)::int`,
        wells: sql<number>`coalesce(sum(${projects.wellsCount}), 0)::int`,
        projects: count(),
      })
      .from(projects)
      .where(eq(projects.publishStatus, 'published')),
  ])

  const palette = theme?.tokens.colors.light
  const primary = palette?.primary ?? '#0a6d8f'
  const surface = palette?.surface ?? '#f6f9fb'
  const ink = palette?.foreground ?? '#0f1c26'
  const muted = palette?.mutedForeground ?? '#5b6b78'

  const value = formatNumber(
    metric === 'wells' ? (totals?.wells ?? 0) : (totals?.people ?? 0),
    locale,
  )
  const label = metric === 'wells' ? 'water points built' : 'people served'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(`${value} ${label} — ${settings.siteName}`)}">
  <rect width="${WIDTH}" height="${HEIGHT}" rx="14" fill="${surface}"/>
  <rect x="0" y="0" width="6" height="${HEIGHT}" rx="3" fill="${primary}"/>
  <text x="24" y="52" font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="${primary}">${escapeXml(value)}</text>
  <text x="24" y="76" font-family="system-ui, sans-serif" font-size="14" fill="${ink}">${escapeXml(label)}</text>
  <text x="24" y="100" font-family="system-ui, sans-serif" font-size="12" fill="${muted}">${escapeXml(settings.siteName)} · ${escapeXml(new URL(localeUrl(locale, '/')).host)}</text>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      // Refreshed hourly: a badge is decoration on someone else's page, and
      // hammering the database for it would be a poor trade.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
