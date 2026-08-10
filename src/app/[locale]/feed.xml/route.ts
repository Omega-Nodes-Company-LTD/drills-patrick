import { renderFeed } from '@/lib/seo/feed'

export const dynamic = 'force-dynamic'

/** `/it/feed.xml` and friends. The default locale is served from the root. */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return renderFeed(locale)
}
