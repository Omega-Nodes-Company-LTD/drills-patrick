import type { Locale } from '@/i18n/config'
import { getProjectBySlug } from '@/lib/content/queries'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og'
import { getSiteSettings } from '@/lib/settings/service'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Project'

/**
 * Social card for a project without a cover photo. The eyebrow carries the
 * location, which is the first thing a reader wants from a water-point link.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }

  const [result, settings] = await Promise.all([
    getProjectBySlug(slug, locale).catch(() => null),
    getSiteSettings(),
  ])

  const place = [result?.project.district, result?.project.country].filter(Boolean).join(', ')

  return renderOgImage({
    title: result?.translation?.title ?? settings.siteName,
    eyebrow: place || null,
    footer: settings.siteName,
  })
}
