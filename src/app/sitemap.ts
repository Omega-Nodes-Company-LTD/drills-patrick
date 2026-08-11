import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/url'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  campaignTranslations,
  campaigns,
  pageTranslations,
  pages,
  postTranslations,
  posts,
  projectTranslations,
  projects,
} from '@/db/schema'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { getMediaByIds } from '@/lib/media/service'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'


// Rendered per request: the content lives in the database, so the Docker
// build never needs a database connection.
export const dynamic = 'force-dynamic'

/**
 * Sitemap covering every locale. Each entry lists its translated siblings under
 * `alternates.languages` so search engines pair them up.
 */


function url(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return absoluteUrl(locale === defaultLocale ? clean : `/${locale}${clean}`)
}

function entry(
  paths: Partial<Record<Locale, string>>,
  lastModified: Date,
  priority: number,
  images?: string[],
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(paths).map(([locale, path]) => [locale, url(locale as Locale, path!)]),
  )

  return Object.entries(paths).map(([locale, path]) => ({
    url: url(locale as Locale, path!),
    lastModified,
    changeFrequency: 'weekly' as const,
    priority,
    alternates: { languages },
    // Photographs of the finished water point are the site's most reusable
    // asset and the only way a project appears in an image search; nothing
    // else on the page points a crawler at the gallery.
    images: images && images.length > 0 ? images : undefined,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Languages switched off in the settings are not advertised to search engines.
  const settings = await getSiteSettings()
  const active = locales.filter((locale) => settings.enabledLocales.includes(locale))

  const staticPaths = [
    '/',
    '/projects',
    '/blog',
    '/campaigns',
    '/donate',
    '/faq',
    '/team',
    '/partners',
    '/capabilities',
    '/data',
    '/spending',
    '/updates',
  ]
  const now = new Date()

  const items: MetadataRoute.Sitemap = staticPaths.flatMap((path) =>
    entry(
      Object.fromEntries(active.map((locale) => [locale, path])) as Record<Locale, string>,
      now,
      path === '/' ? 1 : 0.8,
    ),
  )

  const [pageRows, postRows, projectRows, campaignRows] = await Promise.all([
    db
      .select({
        id: pages.id,
        updatedAt: pages.updatedAt,
        locale: pageTranslations.locale,
        slug: pageTranslations.slug,
      })
      .from(pages)
      .innerJoin(pageTranslations, eq(pageTranslations.pageId, pages.id))
      // Pages the editor excluded must not be advertised.
      .where(and(eq(pages.status, 'published'), eq(pages.showInSitemap, true))),
    db
      .select({
        id: posts.id,
        updatedAt: posts.updatedAt,
        locale: postTranslations.locale,
        slug: postTranslations.slug,
      })
      .from(posts)
      .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
      .where(eq(posts.status, 'published')),
    db
      .select({
        id: projects.id,
        updatedAt: projects.updatedAt,
        locale: projectTranslations.locale,
        slug: projectTranslations.slug,
        coverId: projects.coverId,
        galleryIds: projects.galleryIds,
      })
      .from(projects)
      .innerJoin(projectTranslations, eq(projectTranslations.projectId, projects.id))
      .where(eq(projects.publishStatus, 'published')),
    db
      .select({
        id: campaigns.id,
        updatedAt: campaigns.updatedAt,
        locale: campaignTranslations.locale,
        slug: campaignTranslations.slug,
      })
      .from(campaigns)
      .innerJoin(campaignTranslations, eq(campaignTranslations.campaignId, campaigns.id))
      .where(eq(campaigns.status, 'published')),
  ])

  // Project photographs, resolved once for the whole sitemap.
  const projectImageIds = projectRows.flatMap((row) =>
    [row.coverId, ...(row.galleryIds ?? [])].filter((value): value is string => Boolean(value)),
  )
  const projectImages = await getMediaByIds(projectImageIds)

  const imagesFor = (row: (typeof projectRows)[number]): string[] =>
    [row.coverId, ...(row.galleryIds ?? [])]
      .filter((value): value is string => Boolean(value))
      .map((id) => mediaUrl(projectImages.get(id)?.objectKey))
      .filter((value): value is string => Boolean(value))

  const groups: [typeof pageRows, string, number][] = [
    [pageRows, '', 0.6],
    [postRows, '/blog', 0.7],
    [projectRows, '/projects', 0.9],
    [campaignRows, '/campaigns', 0.8],
  ]

  for (const [rows, prefix, priority] of groups) {
    const byEntity = new Map<
      string,
      { updatedAt: Date; paths: Partial<Record<Locale, string>>; images: string[] }
    >()

    for (const row of rows) {
      if (!active.includes(row.locale as Locale)) continue
      const current = byEntity.get(row.id) ?? {
        updatedAt: row.updatedAt,
        paths: {},
        images: 'galleryIds' in row ? imagesFor(row as (typeof projectRows)[number]) : [],
      }
      current.paths[row.locale as Locale] = `${prefix}/${row.slug}`
      byEntity.set(row.id, current)
    }

    for (const value of byEntity.values()) {
      items.push(...entry(value.paths, value.updatedAt, priority, value.images))
    }
  }

  return items
}
