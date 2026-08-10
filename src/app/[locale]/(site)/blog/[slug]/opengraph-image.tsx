import type { Locale } from '@/i18n/config'
import { getPostBySlug } from '@/lib/content/queries'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og'
import { getSiteSettings } from '@/lib/settings/service'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Article'

/**
 * Social card for an article. Next.js only reaches this route when the page's
 * metadata does not already point at a cover photo, so the generated card is
 * the fallback rather than the norm.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }

  const [result, settings] = await Promise.all([
    getPostBySlug(slug, locale).catch(() => null),
    getSiteSettings(),
  ])

  return renderOgImage({
    title: result?.translation?.title ?? settings.siteName,
    eyebrow: result?.post.publishedAt?.toISOString().slice(0, 10) ?? null,
    footer: settings.siteName,
  })
}
