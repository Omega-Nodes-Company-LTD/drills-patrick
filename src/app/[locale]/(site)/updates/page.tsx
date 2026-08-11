import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { intlLocale, type Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { listRecentUpdates } from '@/lib/transparency/registry'
import { sanitizeHtml } from '@/lib/sanitize'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

/**
 * Everything that happened, newest first, across every project.
 *
 * The timeline on a project page answers "how is this one going". This
 * answers "is anything happening at all", which is the question a donor asks
 * six months after giving and currently has no way to settle without opening
 * projects one by one.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'updates' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/updates', settings.enabledLocales),
  }
}

export default async function UpdatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tNav, tCommon, updates] = await Promise.all([
    getTranslations('updates'),
    getTranslations('nav'),
    getTranslations('common'),
    listRecentUpdates(locale, 100),
  ])

  const url = localeUrl(locale, '/updates')
  const dates = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <JsonLd
        nodes={[
          webPageNode({ locale, url, name: t('title'), description: t('subtitle') }),
          sectionBreadcrumb({
            locale,
            homeName: tNav('home'),
            pageName: t('title'),
            pageUrl: url,
          }),
        ]}
      />

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-narrow py-12">
        {updates.length === 0 ? (
          <EmptyState message={tCommon('noResults')} />
        ) : (
          <ol className="flex flex-col gap-8">
            {updates.map((update) => (
              <li key={update.id} className="border-s-2 border-border ps-5">
                <p className="text-small text-muted-foreground">
                  <time dateTime={update.happenedOn}>
                    {dates.format(new Date(`${update.happenedOn}T00:00:00Z`))}
                  </time>
                  {' · '}
                  <Link href={`/projects/${update.projectSlug}`} className="hover:underline">
                    {update.projectTitle}
                  </Link>
                </p>

                {update.title ? <h2 className="mt-1 text-heading">{update.title}</h2> : null}

                {update.body ? (
                  <div
                    className="prose-content mt-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(update.body) }}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}
