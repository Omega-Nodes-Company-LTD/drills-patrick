import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/url'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { BlockList } from '@/components/blocks/render'
import { EmptyPageNotice } from '@/components/site/empty-page-notice'
import type { Locale } from '@/i18n/config'
import { parseBlocks } from '@/lib/blocks/schema'
import { getPageBySlug } from '@/lib/content/queries'


/**
 * Catch-all for editor-managed pages (about, contact, legal pages, and any
 * page created later from the admin). Static routes such as `/projects` win
 * over this segment.
 */

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  const result = await getPageBySlug(slug, locale)
  if (!result) return {}

  const alternates = Object.fromEntries(
    result.translations.map((translation) => [
      translation.locale,
      absoluteUrl(`/${translation.locale}/${translation.slug}`),
    ]),
  )

  return {
    title: result.translation?.seoTitle || result.translation?.title,
    description: result.translation?.seoDescription ?? undefined,
    alternates: { languages: alternates },
  }
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  setRequestLocale(locale)

  const result = await getPageBySlug(slug, locale)
  if (!result) notFound()

  const blocks = parseBlocks(result.page.blocks ?? [])

  if (blocks.length === 0) {
    return (
      <>
        <div className="container-page pt-12">
          <h1 className="text-title">{result.translation?.title}</h1>
        </div>
        <EmptyPageNotice pageKey={result.page.key} />
      </>
    )
  }

  return <BlockList blocks={blocks} locale={locale} />
}
