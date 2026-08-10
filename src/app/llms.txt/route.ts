import { defaultLocale } from '@/i18n/config'
import { buildLlmsIndex } from '@/lib/seo/llms'

export const dynamic = 'force-dynamic'

/**
 * The default locale carries no prefix, and the middleware skips paths with a
 * file extension, so this is served directly rather than rewritten.
 */
export async function GET() {
  return new Response(await buildLlmsIndex(defaultLocale), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  })
}
