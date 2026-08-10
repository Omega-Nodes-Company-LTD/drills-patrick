import { defaultLocale } from '@/i18n/config'
import { buildLlmsFull } from '@/lib/seo/llms'

export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(await buildLlmsFull(defaultLocale), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  })
}
