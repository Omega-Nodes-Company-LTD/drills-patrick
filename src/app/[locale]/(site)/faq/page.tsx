import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { FaqAccordion } from '@/components/site/faq-accordion'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { listFaqs } from '@/lib/content/queries'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { faqPageNode, sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { JsonLd } from '@/components/seo/json-ld'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'faq' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/faq', settings.enabledLocales),
  }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tCommon, tNav, items] = await Promise.all([
    getTranslations('faq'),
    getTranslations('common'),
    getTranslations('nav'),
    listFaqs(locale),
  ])

  const url = localeUrl(locale, '/faq')

  // Grouped by the free-text category the editor typed, in first-seen order.
  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key = item.category?.trim() || ''
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return (
    <>
      <JsonLd
        nodes={[
          webPageNode({
            locale,
            url,
            name: t('title'),
            description: t('subtitle'),
            speakable: true,
          }),
          sectionBreadcrumb({
            locale,
            homeName: tNav('home'),
            pageName: t('title'),
            pageUrl: url,
          }),
          faqPageNode({ url, items }),
        ]}
      />

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page flex flex-col gap-10 py-12">
        {items.length === 0 ? (
          <EmptyState message={tCommon('noResults')} />
        ) : (
          [...groups.entries()].map(([category, entries]) => (
            <section key={category || 'general'} className="flex flex-col gap-4">
              {category ? <h2 className="text-heading">{category}</h2> : null}
              <FaqAccordion items={entries} />
            </section>
          ))
        )}
      </div>
    </>
  )
}
