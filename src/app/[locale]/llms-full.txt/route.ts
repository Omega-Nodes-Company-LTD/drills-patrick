import { buildLlmsFull, resolveLlmsLocale } from '@/lib/seo/llms'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const settings = await getSiteSettings()
  const locale = resolveLlmsLocale(raw, settings.enabledLocales)
  if (!locale) return new Response('Not found', { status: 404 })

  return new Response(await buildLlmsFull(locale), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  })
}
