import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { buildAlternates, localeUrl, pathsFromTranslations } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { JsonLd } from '@/components/seo/json-ld'
import { notFound } from 'next/navigation'
import { permanentRedirect } from '@/i18n/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
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

  const settings = await getSiteSettings()

  return {
    title: result.translation?.seoTitle || result.translation?.title,
    description: result.translation?.seoDescription ?? undefined,
    // Own canonical: without it the page would inherit the locale layout's,
    // which points at the home page.
    alternates: buildAlternates({
      locale,
      paths: pathsFromTranslations(result.translations, ''),
      enabledLocales: settings.enabledLocales,
    }),
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

  // Either the slug belongs to another language or it is one the page used
  // to live at. Permanent, not temporary: the old URL is not coming back,
  // and 308 is what moves a search engine's index and its authority.
  if (result.redirectTo) permanentRedirect({ href: `/${result.redirectTo}`, locale })

  const tNav = await getTranslations('nav')
  const blocks = parseBlocks(result.page.blocks ?? [])
  const url = localeUrl(locale, `/${result.translation?.slug ?? slug}`)

  const graph = (
    <JsonLd
      nodes={[
        webPageNode({
          locale,
          url,
          name: result.translation?.title ?? '',
          description: result.translation?.seoDescription,
          dateModified: result.page.updatedAt,
        }),
        sectionBreadcrumb({
          locale,
          homeName: tNav('home'),
          pageName: result.translation?.title ?? '',
          pageUrl: url,
        }),
      ]}
    />
  )

  if (blocks.length === 0) {
    return (
      <>
        {graph}
        <div className="container-page pt-12">
          <h1 className="text-title">{result.translation?.title}</h1>
        </div>
        <EmptyPageNotice pageKey={result.page.key} />
      </>
    )
  }

  return (
    <>
      {graph}
      <BlockList blocks={blocks} locale={locale} />
    </>
  )
}
