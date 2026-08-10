import type { Locale } from '@/i18n/config'
import { getCampaignBySlug } from '@/lib/content/queries'
import { formatMoney } from '@/lib/money'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og'
import { getSiteSettings } from '@/lib/settings/service'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Campaign'

/**
 * Social card for a campaign without a cover photo. The eyebrow shows the
 * goal, which is the one number that makes a fundraising link worth opening.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }

  const [result, settings] = await Promise.all([
    getCampaignBySlug(slug, locale).catch(() => null),
    getSiteSettings(),
  ])

  const goal = result?.campaign.goalAmount
    ? formatMoney(result.campaign.goalAmount, result.campaign.currency, locale, {
        hideDecimals: true,
      })
    : null

  return renderOgImage({
    title: result?.translation?.title ?? settings.siteName,
    eyebrow: goal,
    footer: settings.siteName,
  })
}
