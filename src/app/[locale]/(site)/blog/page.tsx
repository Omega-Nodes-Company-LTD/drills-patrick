import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { listingRobots, staticAlternates } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { PostCard } from '@/components/site/cards'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { Pagination } from '@/components/site/pagination'
import { Badge } from '@/components/ui/badge'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { listCategories, listPosts } from '@/lib/content/queries'

// Rendered per request: the content lives in the database, so the Docker
// build never needs a database connection.
export const dynamic = 'force-dynamic'

const PER_PAGE = 9

type SearchParams = Promise<{ page?: string; category?: string; tag?: string }>

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const query = await searchParams
  const t = await getTranslations({ locale, namespace: 'blog' })
  const settings = await getSiteSettings()

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/blog', settings.enabledLocales),
    robots: listingRobots(query),
  }
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const query = await searchParams
  const t = await getTranslations('blog')
  const page = Math.max(1, Number(query.page) || 1)

  const [{ items, total }, categories] = await Promise.all([
    listPosts({
      locale,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
      categorySlug: query.category,
      tagSlug: query.tag,
    }),
    listCategories(locale),
  ])

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')}>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/blog">
              <Badge variant={query.category ? 'outline' : 'primary'}>{t('allPosts')}</Badge>
            </Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/blog?category=${category.slug}`}>
                <Badge variant={query.category === category.slug ? 'primary' : 'outline'}>
                  {category.name}
                </Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </PageHeader>

      <div className="container-page py-10 md:py-14">
        {items.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((post) => (
                <PostCard key={post.id} post={post} locale={locale} />
              ))}
            </div>
            <Suspense fallback={null}>
              <Pagination page={page} total={total} perPage={PER_PAGE} />
            </Suspense>
          </>
        )}
      </div>
    </>
  )
}
