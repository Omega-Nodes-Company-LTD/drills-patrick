import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Search as SearchIcon, Sparkles } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { Badge } from '@/components/ui/badge'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { search } from '@/lib/search/service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const t = await getTranslations({ locale, namespace: 'search' })
  return { title: t('title'), robots: { index: false, follow: true } }
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const { q } = await searchParams
  const t = await getTranslations('search')
  const query = (q ?? '').trim()

  const { results, semantic } = query ? await search(query, locale) : { results: [], semantic: false }

  return (
    <>
      <PageHeader title={t('title')}>
        <form action="" method="get" className="flex max-w-xl gap-2">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              className="h-11 w-full rounded-[var(--radius-sm)] border border-border bg-background ps-9 pe-3 text-base"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-[var(--radius-sm)] bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {t('submit')}
          </button>
        </form>

        {semantic ? (
          <p className="flex items-center gap-1.5 text-small text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            {t('semantic')}
          </p>
        ) : null}
      </PageHeader>

      <div className="container-page py-10 md:py-14">
        {!query ? null : results.length === 0 ? (
          <EmptyState message={`${t('noResults', { query })} ${t('suggestions')}`} />
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">{t('resultsFor', { query })}</p>
            <ul className="flex flex-col gap-4">
              {results.map((result) => (
                <li
                  key={`${result.entityType}-${result.entityId}`}
                  className="rounded-[var(--radius-lg)] border border-border p-5 transition-colors hover:border-primary"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge variant="outline">{t(`types.${result.entityType}`)}</Badge>
                    {result.matchedBy !== 'keyword' ? (
                      <Sparkles className="size-3.5 text-accent" aria-hidden />
                    ) : null}
                  </div>
                  <h2 className="text-subheading font-semibold">
                    <Link href={result.url.replace(new RegExp(`^/${locale}`), '') || '/'}>
                      {result.title}
                    </Link>
                  </h2>
                  {result.snippet ? (
                    <p className="mt-1 text-sm text-muted-foreground">{result.snippet}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
