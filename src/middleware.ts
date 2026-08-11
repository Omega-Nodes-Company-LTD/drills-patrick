import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Run on every path except API routes, Next internals, and files with an
  // extension (images, fonts, sitemap.xml, ...).
  //
  // `embed` is excluded for the same reason as `api`: those routes are fetched
  // by a partner's page, not navigated to. They carry their own `?locale`, and
  // being rewritten under a locale prefix turns them into a 404 on a site the
  // partner controls — where nobody here would ever see it.
  matcher: ['/((?!api|embed|_next|_vercel|.*\\..*).*)'],
}
