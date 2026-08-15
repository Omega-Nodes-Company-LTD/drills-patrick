import { Download, FileCheck2 } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { RegistryTable } from '@/components/site/registry-table'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { listRegistry } from '@/lib/transparency/registry'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

/**
 * The public register of water points.
 *
 * Same data for a funder, a journalist and the district water officer: no
 * account, no request form, and the whole thing downloadable. A register that
 * can only be read one page at a time is not a register.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'registry' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/data', settings.enabledLocales),
  }
}

export default async function DataRegistryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tNav, tProjects, settings, rows] = await Promise.all([
    getTranslations('registry'),
    getTranslations('nav'),
    getTranslations('projects'),
    getSiteSettings(),
    listRegistry(locale),
  ])

  const url = localeUrl(locale, '/data')
  const licence = settings.seo.contentLicence

  const districts = [...new Set(rows.map((row) => row.district).filter(Boolean))].sort() as string[]

  const certificateCount = rows.reduce((total, row) => total + row.certificates.length, 0)

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
          // Declared as a dataset, which is how a data portal or an answer
          // engine recognises this as something to index rather than prose.
          {
            '@type': 'Dataset',
            '@id': `${url}#dataset`,
            name: t('title'),
            description: t('subtitle'),
            license: settings.seo.contentLicenceUrl || undefined,
            creator: { '@type': 'Organization', name: settings.siteName },
            distribution: [
              {
                '@type': 'DataDownload',
                encodingFormat: 'text/csv',
                contentUrl: localeUrl(locale, '/data.csv'),
              },
              {
                '@type': 'DataDownload',
                encodingFormat: 'application/json',
                contentUrl: localeUrl(locale, '/projects.json'),
              },
            ],
          },
        ]}
      />

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page flex flex-col gap-6 py-12">
        <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <div className="flex-1">
            <p className="text-small text-muted-foreground">
              {t('summary', {
                points: rows.length,
                districts: districts.length,
                certificates: certificateCount,
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {/* Stated on the page, not only in a machine-readable header:
                  a reader deciding whether they may reuse this should not
                  have to fetch llms.txt to find out. */}
              {licence ? t('licence', { licence }) : t('licenceUnset')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/data.csv"
              download
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground pointer-coarse:min-h-11"
            >
              <Download className="size-4" aria-hidden />
              CSV
            </a>
            <a
              href="/projects.json"
              className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-medium pointer-coarse:min-h-11"
            >
              <FileCheck2 className="size-4" aria-hidden />
              JSON
            </a>
          </div>
        </div>

        <RegistryTable
          rows={rows}
          districts={districts}
          locale={locale}
          labels={{
            filterDistrict: t('filterDistrict'),
            filterStatus: t('filterStatus'),
            all: tProjects('status.all'),
            search: t('search'),
            empty: tProjects('empty'),
            name: t('columns.name'),
            place: t('columns.place'),
            status: t('columns.status'),
            depth: t('columns.depth'),
            yield: t('columns.yield'),
            people: t('columns.people'),
            completed: t('columns.completed'),
            certificates: t('columns.certificates'),
            measuredOn: t('measuredOn'),
            statuses: {
              planned: tProjects('status.planned'),
              in_progress: tProjects('status.in_progress'),
              completed: tProjects('status.completed'),
            },
          }}
        />
      </div>
    </>
  )
}
