import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { buildAlternates, pathsFromTranslations } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
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

  // The slug belongs to another language: send the visitor to the canonical
  // URL for this one instead of serving the same content twice.
  if (result.redirectTo) redirect({ href: `/${result.redirectTo}`, locale })

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
