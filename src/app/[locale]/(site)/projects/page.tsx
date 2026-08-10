import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { listingRobots, staticAlternates } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ProjectCard } from '@/components/site/cards'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { Pagination } from '@/components/site/pagination'
import { ProjectFilters } from '@/components/site/project-filters'
import type { Locale } from '@/i18n/config'
import { listProjectDistricts, listProjects } from '@/lib/content/queries'

// Rendered per request: the content lives in the database, so the Docker
// build never needs a database connection.
export const dynamic = 'force-dynamic'

const PER_PAGE = 12

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const query = await searchParams
  const t = await getTranslations({ locale, namespace: 'projects' })
  const settings = await getSiteSettings()

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/projects', settings.enabledLocales),
    robots: listingRobots(query),
  }
}

type SearchParams = Promise<{
  status?: string
  type?: string
  district?: string
  page?: string
}>

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const query = await searchParams
  const t = await getTranslations('projects')
  const page = Math.max(1, Number(query.page) || 1)

  const status =
    query.status === 'planned' || query.status === 'in_progress' || query.status === 'completed'
      ? query.status
      : undefined

  const [{ items, total }, districts] = await Promise.all([
    listProjects({
      locale,
      status,
      district: query.district || undefined,
      waterPointType: (query.type as never) || undefined,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    }),
    listProjectDistricts(),
  ])

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')}>
        <Suspense fallback={null}>
          <ProjectFilters districts={districts} />
        </Suspense>
      </PageHeader>

      <div className="container-page py-10 md:py-14">
        {items.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((project) => (
                <ProjectCard key={project.id} project={project} locale={locale} />
              ))}
            </div>
            <Pagination page={page} total={total} perPage={PER_PAGE} />
          </>
        )}
      </div>
    </>
  )
}
