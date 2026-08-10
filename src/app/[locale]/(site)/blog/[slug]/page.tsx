import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { buildAlternates, localeUrl, pathsFromTranslations } from '@/lib/seo'
import { NODE_ID, ref, type GraphNode } from '@/lib/seo/graph'
import { webPageNode } from '@/lib/seo/nodes'
import { JsonLd } from '@/components/seo/json-ld'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PostCard } from '@/components/site/cards'
import { Badge } from '@/components/ui/badge'
import { MediaImage } from '@/components/ui/media-image'
import { ShareButtons } from '@/components/site/share-buttons'
import { intlLocale, type Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { getPostBySlug, listPosts } from '@/lib/content/queries'
import { sanitizeHtml } from '@/lib/sanitize'

import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  const result = await getPostBySlug(slug, locale)
  if (!result) return {}

  const settings = await getSiteSettings()

  const image = mediaUrl(result.cover?.objectKey)

  return {
    title: result.translation?.seoTitle || result.translation?.title,
    description: result.translation?.seoDescription || result.translation?.excerpt || undefined,
    // Own canonical: without it the page would inherit the locale layout's,
    // which points at the home page.
    alternates: buildAlternates({
      locale,
      paths: pathsFromTranslations(result.translations, '/blog'),
      enabledLocales: settings.enabledLocales,
    }),
    openGraph: {
      type: 'article',
      publishedTime: result.post.publishedAt?.toISOString(),
      title: result.translation?.title,
      description: result.translation?.excerpt ?? undefined,
      images: image ? [image] : undefined,
    },
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  setRequestLocale(locale)

  const result = await getPostBySlug(slug, locale)
  if (!result) notFound()

  // The slug belongs to another language: send the visitor to the canonical
  // URL for this one instead of serving the same content twice.
  if (result.redirectTo) redirect({ href: `/blog/${result.redirectTo}`, locale })

  const t = await getTranslations('blog')
  const { post, translation, cover, tags, authorName } = result

  const related = await listPosts({ locale, limit: 3, excludeId: post.id })

  const publishedLabel = post.publishedAt
    ? new Intl.DateTimeFormat(intlLocale(locale), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(post.publishedAt)
    : null

  const url = localeUrl(locale, `/blog/${translation?.slug ?? slug}`)

  const article: GraphNode = {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: translation?.title,
    description: translation?.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    inLanguage: locale,
    author: authorName ? { '@type': 'Person', name: authorName } : undefined,
    image: mediaUrl(cover?.objectKey) || undefined,
    // Ties the article to the URL it is published at rather than leaving two
    // unrelated descriptions of the same page.
    mainEntityOfPage: ref(NODE_ID.page(url)),
  }

  return (
    <article className="pb-16">
      <JsonLd
        nodes={[
          webPageNode({
            locale,
            url,
            name: translation?.title ?? '',
            description: translation?.excerpt,
            dateModified: post.updatedAt,
          }),
          article,
        ]}
      />

      <header className="container-narrow pt-10 md:pt-16">
        <div className="flex flex-wrap items-center gap-3 text-small text-muted-foreground">
          {publishedLabel ? (
            <time dateTime={post.publishedAt?.toISOString()}>
              {t('publishedOn', { date: publishedLabel })}
            </time>
          ) : null}
          <span aria-hidden>·</span>
          <span>{t('readingTime', { minutes: post.readingMinutes })}</span>
          {authorName ? (
            <>
              <span aria-hidden>·</span>
              <span>{t('by', { name: authorName })}</span>
            </>
          ) : null}
        </div>

        <h1 className="mt-3 text-title">{translation?.title}</h1>

        {translation?.excerpt ? (
          <p className="mt-4 text-lg text-muted-foreground">{translation.excerpt}</p>
        ) : null}
      </header>

      {cover ? (
        <div className="container-page my-8">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-xl)] bg-muted">
            <MediaImage media={cover} locale={locale} priority sizes="100vw" />
          </div>
        </div>
      ) : null}

      <div className="container-narrow">
        {translation?.contentHtml ? (
          <div
            className="prose-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(translation.contentHtml) }}
          />
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <Link href={`/blog?tag=${tag.slug}`}>
                    <Badge variant="outline">#{tag.name}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <ShareButtons title={translation?.title ?? ''} />
        </div>
      </div>

      {related.items.length > 0 ? (
        <section className="container-page mt-16">
          <h2 className="mb-6 text-heading">{t('related')}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.items.map((item) => (
              <PostCard key={item.id} post={item} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}
