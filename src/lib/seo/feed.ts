import { locales, type Locale } from '@/i18n/config'
import { listPosts } from '@/lib/content/queries'
import { localeUrl } from '@/lib/seo'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'
import { pickI18n } from '@/i18n/config'

/**
 * RSS 2.0 feed, one per language.
 *
 * A feed is how a partner NGO, a journalist or an aggregator follows the site
 * without polling it by hand, and it is still the cheapest way for an answer
 * engine to notice that something was published. Per-locale because an Italian
 * reader subscribing to updates should not receive Luganda articles.
 */

const ITEMS = 40

/** XML text nodes: five characters, none of them optional. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function renderFeed(raw: string): Promise<Response> {
  const locale = (locales as readonly string[]).includes(raw) ? (raw as Locale) : null
  if (!locale) return new Response('Not found', { status: 404 })

  const settings = await getSiteSettings()

  // A language the operator switched off should not advertise a feed either.
  if (!settings.enabledLocales.includes(locale)) {
    return new Response('Not found', { status: 404 })
  }

  const { items } = await listPosts({ locale, limit: ITEMS })

  const feedUrl = localeUrl(locale, '/feed.xml')
  const siteUrl = localeUrl(locale, '/')
  const description = pickI18n(settings.description, locale) || settings.siteName

  const entries = items
    .map((post) => {
      const url = localeUrl(locale, `/blog/${post.slug}`)
      const image = mediaUrl(post.cover?.objectKey)

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      ${post.publishedAt ? `<pubDate>${post.publishedAt.toUTCString()}</pubDate>` : ''}
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ''}
      ${post.authorName ? `<dc:creator>${escapeXml(post.authorName)}</dc:creator>` : ''}
      ${post.category ? `<category>${escapeXml(post.category.name)}</category>` : ''}
      ${image ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" />` : ''}
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(settings.siteName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>${locale}</language>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600',
    },
  })
}
