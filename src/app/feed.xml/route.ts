import { defaultLocale } from '@/i18n/config'
import { renderFeed } from '@/lib/seo/feed'

export const dynamic = 'force-dynamic'

/**
 * The default locale carries no prefix, and the middleware skips paths with a
 * file extension, so `/feed.xml` would never be rewritten to `/en/feed.xml`.
 * It is served here directly, next to robots.txt and sitemap.xml.
 */
export async function GET() {
  return renderFeed(defaultLocale)
}
