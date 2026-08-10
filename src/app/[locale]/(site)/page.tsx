import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { BlockList } from '@/components/blocks/render'
import { EmptyPageNotice } from '@/components/site/empty-page-notice'
import type { Locale } from '@/i18n/config'
import { parseBlocks } from '@/lib/blocks/schema'
import { getPageByKey } from '@/lib/content/queries'
import { getSiteSettings } from '@/lib/settings/service'
import { pickI18n } from '@/i18n/config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [page, settings] = await Promise.all([getPageByKey('home', locale), getSiteSettings()])

  return {
    title: page?.translation?.seoTitle || settings.siteName,
    description:
      page?.translation?.seoDescription ||
      pickI18n(settings.seo.metaDescription, locale) ||
      pickI18n(settings.description, locale),
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const page = await getPageByKey('home', locale)
  const blocks = parseBlocks(page?.page.blocks ?? [])

  if (blocks.length === 0) {
    return <EmptyPageNotice pageKey="home" />
  }

  return <BlockList blocks={blocks} locale={locale} />
}
