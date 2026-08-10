import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import {
  campaignTranslations,
  campaigns,
  categories,
  categoryTranslations,
  faqTranslations,
  faqs,
  media,
  pageTranslations,
  pages,
  partnerTranslations,
  partners,
  postTags,
  postTranslations,
  posts,
  projectTranslations,
  projectUpdateTranslations,
  projectUpdates,
  projects,
  tagTranslations,
  tags,
  teamMemberTranslations,
  teamMembers,
  testimonialTranslations,
  testimonials,
  users,
  type MediaRow,
} from '@/db/schema'
import { defaultLocale, type Locale } from '@/i18n/config'
import { resolveRetiredSlug } from './redirects'
import { groupByParent, pickTranslation } from './translations'
import { getMediaByIds } from '@/lib/media/service'

/**
 * Read models for the public site.
 *
 * Every list query loads the requested locale plus the default locale, then
 * resolves the fallback in JavaScript — one extra row per entity, and no
 * lateral joins to maintain.
 */

/**
 * The slug this entity should live at in the active locale, when the URL used a
 * different one.  means the URL is already canonical.
 */
function redirectSlug(resolved: { slug: string } | undefined, requested: string): string | null {
  return resolved && resolved.slug !== requested ? resolved.slug : null
}

/** Loads the requested locale plus the default one, ready for the fallback. */
const localeFilter = (column: PgColumn, locale: Locale) =>
  locale === defaultLocale
    ? eq(column, defaultLocale)
    : inArray(column, [locale, defaultLocale])

// ------------------------------------------------------------------ projects

export type ProjectListItem = {
  id: string
  slug: string
  title: string
  summary: string | null
  status: (typeof projects.$inferSelect)['status']
  waterPointType: (typeof projects.$inferSelect)['waterPointType']
  country: string
  district: string | null
  region: string | null
  village: string | null
  latitude: number | null
  longitude: number | null
  beneficiaries: number
  wellsCount: number
  depthMeters: number | null
  completionDate: string | null
  plannedCompletionDate: string | null
  isFeatured: boolean
  cover: MediaRow | null
}

export type ProjectFilters = {
  locale: Locale
  status?: 'planned' | 'in_progress' | 'completed'
  district?: string
  waterPointType?: ProjectListItem['waterPointType']
  featuredOnly?: boolean
  limit?: number
  offset?: number
}

export async function listProjects(filters: ProjectFilters) {
  const conditions = [eq(projects.publishStatus, 'published')]
  if (filters.status) conditions.push(eq(projects.status, filters.status))
  if (filters.district) conditions.push(eq(projects.district, filters.district))
  if (filters.waterPointType) conditions.push(eq(projects.waterPointType, filters.waterPointType))
  if (filters.featuredOnly) conditions.push(eq(projects.isFeatured, true))

  const where = and(...conditions)

  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(where)
      .orderBy(desc(projects.isFeatured), projects.sortOrder, desc(projects.createdAt))
      .limit(filters.limit ?? 24)
      .offset(filters.offset ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(projects).where(where),
  ])

  const items = await decorateProjects(rows, filters.locale)
  return { items, total: countRow?.count ?? 0 }
}

async function decorateProjects(
  rows: (typeof projects.$inferSelect)[],
  locale: Locale,
): Promise<ProjectListItem[]> {
  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)
  const translations = await db
    .select()
    .from(projectTranslations)
    .where(
      and(
        inArray(projectTranslations.projectId, ids),
        localeFilter(projectTranslations.locale, locale),
      ),
    )

  const byProject = groupByParent(translations, 'projectId')
  const covers = await getMediaByIds(rows.map((row) => row.coverId).filter(Boolean) as string[])

  return rows.map((row) => {
    const translation = pickTranslation(byProject.get(row.id), locale)
    return {
      id: row.id,
      slug: translation?.slug ?? row.id,
      title: translation?.title ?? '',
      summary: translation?.summary ?? null,
      status: row.status,
      waterPointType: row.waterPointType,
      country: row.country,
      district: row.district,
      region: row.region,
      village: row.village,
      latitude: row.latitude,
      longitude: row.longitude,
      beneficiaries: row.beneficiaries,
      wellsCount: row.wellsCount,
      depthMeters: row.depthMeters,
      completionDate: row.completionDate,
      plannedCompletionDate: row.plannedCompletionDate,
      isFeatured: row.isFeatured,
      cover: row.coverId ? (covers.get(row.coverId) ?? null) : null,
    }
  })
}

export async function getProjectBySlug(slug: string, locale: Locale) {
  // Match the slug in the requested language first. A slug belonging to a
  // different language still resolves, but the caller is told to redirect to
  // the right URL so the same content is not served under several paths.
  const [exact] = await db
    .select()
    .from(projectTranslations)
    .where(and(eq(projectTranslations.slug, slug), eq(projectTranslations.locale, locale)))
    .limit(1)

  let translation =
    exact ??
    (await db.select().from(projectTranslations).where(eq(projectTranslations.slug, slug)).limit(1))[0]

  // Still nothing: the slug may be one the entity used to live at, kept so a
  // rename does not turn every inbound link into a 404. Resolving through it
  // leaves `slug` different from the live one, so the caller is told to
  // redirect rather than serve the retired URL.
  if (!translation) {
    const retiredId = await resolveRetiredSlug('project', slug)
    if (!retiredId) return null

    const live = await db.select().from(projectTranslations).where(eq(projectTranslations.projectId, retiredId))
    translation = pickTranslation(live, locale)
  }

  if (!translation) return null

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, translation.projectId), eq(projects.publishStatus, 'published')))
    .limit(1)

  if (!project) return null

  const allTranslations = await db
    .select()
    .from(projectTranslations)
    .where(eq(projectTranslations.projectId, project.id))

  const resolved = pickTranslation(allTranslations, locale) ?? translation

  const updateRows = await db
    .select()
    .from(projectUpdates)
    .where(and(eq(projectUpdates.projectId, project.id), eq(projectUpdates.isPublished, true)))
    .orderBy(desc(projectUpdates.happenedOn))

  const updateTranslations =
    updateRows.length > 0
      ? await db
          .select()
          .from(projectUpdateTranslations)
          .where(
            and(
              inArray(
                projectUpdateTranslations.updateId,
                updateRows.map((row) => row.id),
              ),
              localeFilter(projectUpdateTranslations.locale, locale),
            ),
          )
      : []

  const byUpdate = groupByParent(updateTranslations, 'updateId')

  const mediaIds = [project.coverId, ...(project.galleryIds ?? [])].filter(Boolean) as string[]
  const mediaMap = await getMediaByIds(mediaIds)

  const [linkedCampaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.projectId, project.id), eq(campaigns.status, 'published')))
    .limit(1)

  return {
    project,
    translation: resolved,
    translations: allTranslations,
    redirectTo: redirectSlug(resolved, slug),
    cover: project.coverId ? (mediaMap.get(project.coverId) ?? null) : null,
    gallery: (project.galleryIds ?? [])
      .map((id) => mediaMap.get(id))
      .filter((row): row is MediaRow => Boolean(row)),
    updates: updateRows.map((row) => ({
      ...row,
      translation: pickTranslation(byUpdate.get(row.id), locale),
    })),
    campaignId: linkedCampaign?.id ?? null,
  }
}

export async function listProjectDistricts(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ district: projects.district })
    .from(projects)
    .where(eq(projects.publishStatus, 'published'))
  return rows.map((row) => row.district).filter((value): value is string => Boolean(value)).sort()
}

/** Lightweight payload for the map block. */
export async function listProjectMarkers(locale: Locale) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.publishStatus, 'published'))

  const withCoords = rows.filter((row) => row.latitude != null && row.longitude != null)
  const items = await decorateProjects(withCoords, locale)
  return items
}

// --------------------------------------------------------------------- posts

export type PostListItem = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  publishedAt: Date | null
  readingMinutes: number
  isFeatured: boolean
  cover: MediaRow | null
  authorName: string | null
  category: { id: string; name: string; slug: string; color: string | null } | null
}

export async function listPosts(options: {
  locale: Locale
  limit?: number
  offset?: number
  categoryId?: string
  categorySlug?: string
  tagSlug?: string
  excludeId?: string
  featuredOnly?: boolean
}) {
  const conditions = [eq(posts.status, 'published')]
  if (options.featuredOnly) conditions.push(eq(posts.isFeatured, true))
  if (options.excludeId) conditions.push(ne(posts.id, options.excludeId))

  let categoryId = options.categoryId
  if (options.categorySlug) {
    const [row] = await db
      .select({ categoryId: categoryTranslations.categoryId })
      .from(categoryTranslations)
      .where(eq(categoryTranslations.slug, options.categorySlug))
      .limit(1)
    if (!row) return { items: [], total: 0 }
    categoryId = row.categoryId
  }
  if (categoryId) conditions.push(eq(posts.categoryId, categoryId))

  if (options.tagSlug) {
    const [tagRow] = await db
      .select({ tagId: tagTranslations.tagId })
      .from(tagTranslations)
      .where(eq(tagTranslations.slug, options.tagSlug))
      .limit(1)
    if (!tagRow) return { items: [], total: 0 }

    const tagged = await db
      .select({ postId: postTags.postId })
      .from(postTags)
      .where(eq(postTags.tagId, tagRow.tagId))
    if (tagged.length === 0) return { items: [], total: 0 }
    conditions.push(
      inArray(
        posts.id,
        tagged.map((row) => row.postId),
      ),
    )
  }

  const where = and(...conditions)

  const [rows, [countRow]] = await Promise.all([
    db
      .select({ post: posts, authorName: users.name })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(where)
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
      .limit(options.limit ?? 12)
      .offset(options.offset ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(posts).where(where),
  ])

  if (rows.length === 0) return { items: [], total: countRow?.count ?? 0 }

  const ids = rows.map((row) => row.post.id)
  const translations = await db
    .select()
    .from(postTranslations)
    .where(
      and(inArray(postTranslations.postId, ids), localeFilter(postTranslations.locale, options.locale)),
    )
  const byPost = groupByParent(translations, 'postId')

  const categoryIds = rows
    .map((row) => row.post.categoryId)
    .filter((value): value is string => Boolean(value))
  const categoryRows =
    categoryIds.length > 0
      ? await db
          .select({ category: categories, translation: categoryTranslations })
          .from(categories)
          .innerJoin(
            categoryTranslations,
            eq(categoryTranslations.categoryId, categories.id),
          )
          .where(
            and(
              inArray(categories.id, categoryIds),
              localeFilter(categoryTranslations.locale, options.locale),
            ),
          )
      : []

  const categoryMap = new Map<string, { name: string; slug: string; color: string | null }>()
  for (const row of categoryRows) {
    const existing = categoryMap.get(row.category.id)
    if (!existing || row.translation.locale === options.locale) {
      categoryMap.set(row.category.id, {
        name: row.translation.name,
        slug: row.translation.slug,
        color: row.category.color,
      })
    }
  }

  const covers = await getMediaByIds(
    rows.map((row) => row.post.coverId).filter(Boolean) as string[],
  )

  const items: PostListItem[] = rows.map(({ post, authorName }) => {
    const translation = pickTranslation(byPost.get(post.id), options.locale)
    const category = post.categoryId ? categoryMap.get(post.categoryId) : undefined

    return {
      id: post.id,
      slug: translation?.slug ?? post.id,
      title: translation?.title ?? '',
      excerpt: translation?.excerpt ?? null,
      publishedAt: post.publishedAt,
      readingMinutes: post.readingMinutes,
      isFeatured: post.isFeatured,
      cover: post.coverId ? (covers.get(post.coverId) ?? null) : null,
      authorName,
      category: category ? { id: post.categoryId!, ...category } : null,
    }
  })

  return { items, total: countRow?.count ?? 0 }
}

export async function getPostBySlug(slug: string, locale: Locale) {
  // Match the slug in the requested language first. A slug belonging to a
  // different language still resolves, but the caller is told to redirect to
  // the right URL so the same content is not served under several paths.
  const [exact] = await db
    .select()
    .from(postTranslations)
    .where(and(eq(postTranslations.slug, slug), eq(postTranslations.locale, locale)))
    .limit(1)

  let translation =
    exact ??
    (await db.select().from(postTranslations).where(eq(postTranslations.slug, slug)).limit(1))[0]

  // Still nothing: the slug may be one the entity used to live at, kept so a
  // rename does not turn every inbound link into a 404. Resolving through it
  // leaves `slug` different from the live one, so the caller is told to
  // redirect rather than serve the retired URL.
  if (!translation) {
    const retiredId = await resolveRetiredSlug('post', slug)
    if (!retiredId) return null

    const live = await db.select().from(postTranslations).where(eq(postTranslations.postId, retiredId))
    translation = pickTranslation(live, locale)
  }

  if (!translation) return null

  const [row] = await db
    .select({ post: posts, authorName: users.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.id, translation.postId), eq(posts.status, 'published')))
    .limit(1)

  if (!row) return null

  const allTranslations = await db
    .select()
    .from(postTranslations)
    .where(eq(postTranslations.postId, row.post.id))

  const resolved = pickTranslation(allTranslations, locale) ?? translation

  const tagRows = await db
    .select({ tag: tags, translation: tagTranslations })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .innerJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
    .where(
      and(eq(postTags.postId, row.post.id), localeFilter(tagTranslations.locale, locale)),
    )

  const tagMap = new Map<string, { name: string; slug: string }>()
  for (const entry of tagRows) {
    if (!tagMap.has(entry.tag.id) || entry.translation.locale === locale) {
      tagMap.set(entry.tag.id, { name: entry.translation.name, slug: entry.translation.slug })
    }
  }

  const cover = row.post.coverId ? (await getMediaByIds([row.post.coverId])).get(row.post.coverId) : null

  // A public byline, when the editor set one: the team member's name,
  // qualifications and role rather than the admin account that saved the post.
  const author = row.post.authorMemberId
    ? await getAuthorProfile(row.post.authorMemberId, locale)
    : null

  return {
    post: row.post,
    translation: resolved,
    translations: allTranslations,
    redirectTo: redirectSlug(resolved, slug),
    authorName: author?.name ?? row.authorName,
    author,
    cover: cover ?? null,
    tags: [...tagMap.entries()].map(([id, value]) => ({ id, ...value })),
  }
}

export type AuthorProfile = {
  id: string
  name: string
  role: string | null
  credentials: string | null
  linkedinUrl: string | null
  photo: MediaRow | null
}

/** Public profile of a team member credited as the author of a post. */
export async function getAuthorProfile(
  memberId: string,
  locale: Locale,
): Promise<AuthorProfile | null> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.isPublished, true)))
    .limit(1)

  if (!member) return null

  const translations = await db
    .select()
    .from(teamMemberTranslations)
    .where(eq(teamMemberTranslations.memberId, memberId))

  const photos = member.photoId ? await getMediaByIds([member.photoId]) : null

  return {
    id: member.id,
    name: member.name,
    role: pickTranslation(translations, locale)?.role || null,
    credentials: member.credentials,
    linkedinUrl: member.linkedinUrl,
    photo: member.photoId ? (photos?.get(member.photoId) ?? null) : null,
  }
}

export async function listCategories(locale: Locale) {
  const rows = await db
    .select({ category: categories, translation: categoryTranslations })
    .from(categories)
    .innerJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .where(localeFilter(categoryTranslations.locale, locale))
    .orderBy(categories.sortOrder)

  const map = new Map<string, { id: string; name: string; slug: string; color: string | null }>()
  for (const row of rows) {
    if (!map.has(row.category.id) || row.translation.locale === locale) {
      map.set(row.category.id, {
        id: row.category.id,
        name: row.translation.name,
        slug: row.translation.slug,
        color: row.category.color,
      })
    }
  }
  return [...map.values()]
}

// ----------------------------------------------------------------- campaigns

export type CampaignListItem = {
  id: string
  slug: string
  title: string
  summary: string | null
  goalAmount: number
  raisedAmount: number
  offlineAmount: number
  currency: string
  endsOn: string | null
  isFeatured: boolean
  cover: MediaRow | null
  projectId: string | null
  suggestedAmounts: number[]
}

export async function listCampaigns(options: {
  locale: Locale
  limit?: number
  offset?: number
  activeOnly?: boolean
}) {
  const conditions = [eq(campaigns.status, 'published')]
  if (options.activeOnly) {
    conditions.push(
      or(sql`${campaigns.endsOn} is null`, sql`${campaigns.endsOn} >= current_date`)!,
    )
  }

  const where = and(...conditions)

  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(where)
      .orderBy(desc(campaigns.isFeatured), campaigns.sortOrder, desc(campaigns.createdAt))
      .limit(options.limit ?? 12)
      .offset(options.offset ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(campaigns).where(where),
  ])

  if (rows.length === 0) return { items: [], total: countRow?.count ?? 0 }

  const translations = await db
    .select()
    .from(campaignTranslations)
    .where(
      and(
        inArray(
          campaignTranslations.campaignId,
          rows.map((row) => row.id),
        ),
        localeFilter(campaignTranslations.locale, options.locale),
      ),
    )
  const byCampaign = groupByParent(translations, 'campaignId')
  const covers = await getMediaByIds(rows.map((row) => row.coverId).filter(Boolean) as string[])

  const items: CampaignListItem[] = rows.map((row) => {
    const translation = pickTranslation(byCampaign.get(row.id), options.locale)
    return {
      id: row.id,
      slug: translation?.slug ?? row.id,
      title: translation?.title ?? '',
      summary: translation?.summary ?? null,
      goalAmount: row.goalAmount,
      raisedAmount: row.raisedAmount,
      offlineAmount: row.offlineAmount,
      currency: row.currency,
      endsOn: row.endsOn,
      isFeatured: row.isFeatured,
      cover: row.coverId ? (covers.get(row.coverId) ?? null) : null,
      projectId: row.projectId,
      suggestedAmounts: row.suggestedAmounts ?? [],
    }
  })

  return { items, total: countRow?.count ?? 0 }
}

export async function getCampaignBySlug(slug: string, locale: Locale) {
  // Match the slug in the requested language first. A slug belonging to a
  // different language still resolves, but the caller is told to redirect to
  // the right URL so the same content is not served under several paths.
  const [exact] = await db
    .select()
    .from(campaignTranslations)
    .where(and(eq(campaignTranslations.slug, slug), eq(campaignTranslations.locale, locale)))
    .limit(1)

  let translation =
    exact ??
    (await db.select().from(campaignTranslations).where(eq(campaignTranslations.slug, slug)).limit(1))[0]

  // Still nothing: the slug may be one the entity used to live at, kept so a
  // rename does not turn every inbound link into a 404. Resolving through it
  // leaves `slug` different from the live one, so the caller is told to
  // redirect rather than serve the retired URL.
  if (!translation) {
    const retiredId = await resolveRetiredSlug('campaign', slug)
    if (!retiredId) return null

    const live = await db.select().from(campaignTranslations).where(eq(campaignTranslations.campaignId, retiredId))
    translation = pickTranslation(live, locale)
  }

  if (!translation) return null

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, translation.campaignId), eq(campaigns.status, 'published')))
    .limit(1)

  if (!campaign) return null

  const allTranslations = await db
    .select()
    .from(campaignTranslations)
    .where(eq(campaignTranslations.campaignId, campaign.id))

  const cover = campaign.coverId
    ? ((await getMediaByIds([campaign.coverId])).get(campaign.coverId) ?? null)
    : null

  const [supporters] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from donations
    where campaign_id = ${campaign.id} and status = 'succeeded'
  `)

  const resolved = pickTranslation(allTranslations, locale) ?? translation

  return {
    campaign,
    translation: resolved,
    translations: allTranslations,
    redirectTo: redirectSlug(resolved, slug),
    cover,
    supporters: Number(supporters?.count ?? 0),
  }
}

export async function getCampaignById(id: string, locale: Locale) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
  if (!campaign) return null

  const translations = await db
    .select()
    .from(campaignTranslations)
    .where(eq(campaignTranslations.campaignId, id))

  return { campaign, translation: pickTranslation(translations, locale) }
}

// --------------------------------------------------------------------- pages

export async function getPageByKey(key: string, locale: Locale) {
  const [page] = await db.select().from(pages).where(eq(pages.key, key)).limit(1)
  if (!page || page.status !== 'published') return null

  const translations = await db
    .select()
    .from(pageTranslations)
    .where(eq(pageTranslations.pageId, page.id))

  return { page, translation: pickTranslation(translations, locale), translations }
}

export async function getPageBySlug(slug: string, locale: Locale) {
  // Match the slug in the requested language first. A slug belonging to a
  // different language still resolves, but the caller is told to redirect to
  // the right URL so the same content is not served under several paths.
  const [exact] = await db
    .select()
    .from(pageTranslations)
    .where(and(eq(pageTranslations.slug, slug), eq(pageTranslations.locale, locale)))
    .limit(1)

  let translation =
    exact ??
    (await db.select().from(pageTranslations).where(eq(pageTranslations.slug, slug)).limit(1))[0]

  // Still nothing: the slug may be one the entity used to live at, kept so a
  // rename does not turn every inbound link into a 404. Resolving through it
  // leaves `slug` different from the live one, so the caller is told to
  // redirect rather than serve the retired URL.
  if (!translation) {
    const retiredId = await resolveRetiredSlug('page', slug)
    if (!retiredId) return null

    const live = await db.select().from(pageTranslations).where(eq(pageTranslations.pageId, retiredId))
    translation = pickTranslation(live, locale)
  }

  if (!translation) return null

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, translation.pageId), eq(pages.status, 'published')))
    .limit(1)

  if (!page) return null

  const translations = await db
    .select()
    .from(pageTranslations)
    .where(eq(pageTranslations.pageId, page.id))

  const resolved = pickTranslation(translations, locale) ?? translation

  return { page, translation: resolved, translations, redirectTo: redirectSlug(resolved, slug) }
}

// -------------------------------------------------------------------- people

export async function listFaqs(locale: Locale, ids?: string[]) {
  const conditions = [eq(faqs.isPublished, true)]
  if (ids && ids.length > 0) conditions.push(inArray(faqs.id, ids))

  const rows = await db
    .select({ faq: faqs, translation: faqTranslations })
    .from(faqs)
    .innerJoin(faqTranslations, eq(faqTranslations.faqId, faqs.id))
    .where(and(...conditions, localeFilter(faqTranslations.locale, locale)))
    .orderBy(faqs.sortOrder)

  const map = new Map<string, { id: string; category: string; question: string; answerHtml: string }>()
  for (const row of rows) {
    if (!map.has(row.faq.id) || row.translation.locale === locale) {
      map.set(row.faq.id, {
        id: row.faq.id,
        category: row.faq.category,
        question: row.translation.question,
        answerHtml: row.translation.answerHtml,
      })
    }
  }
  return [...map.values()]
}

export async function listPartners(ids?: string[]) {
  const conditions = [eq(partners.isPublished, true)]
  if (ids && ids.length > 0) conditions.push(inArray(partners.id, ids))

  const rows = await db
    .select()
    .from(partners)
    .where(and(...conditions))
    .orderBy(partners.sortOrder)

  const logos = await getMediaByIds(rows.map((row) => row.logoId).filter(Boolean) as string[])

  return rows.map((row) => ({
    ...row,
    logo: row.logoId ? (logos.get(row.logoId) ?? null) : null,
  }))
}

/**
 * Same list as `listPartners`, plus the description in the requested language.
 * The logo strip on a page block does not need it; the partners page does.
 */
export async function listPartnersWithDescription(locale: Locale) {
  const rows = await listPartners()
  if (rows.length === 0) return []

  const descriptions = await db
    .select()
    .from(partnerTranslations)
    .where(
      inArray(
        partnerTranslations.partnerId,
        rows.map((row) => row.id),
      ),
    )

  const byPartner = groupByParent(descriptions, 'partnerId')

  return rows.map((row) => ({
    ...row,
    description: pickTranslation(byPartner.get(row.id), locale)?.description ?? null,
  }))
}

export async function listTeamMembers(locale: Locale) {
  const rows = await db
    .select({ member: teamMembers, translation: teamMemberTranslations })
    .from(teamMembers)
    .innerJoin(teamMemberTranslations, eq(teamMemberTranslations.memberId, teamMembers.id))
    .where(
      and(eq(teamMembers.isPublished, true), localeFilter(teamMemberTranslations.locale, locale)),
    )
    .orderBy(teamMembers.sortOrder)

  const photos = await getMediaByIds(
    rows.map((row) => row.member.photoId).filter(Boolean) as string[],
  )

  const map = new Map<
    string,
    {
      id: string
      name: string
      role: string
      bio: string | null
      email: string | null
      linkedinUrl: string | null
      photo: MediaRow | null
    }
  >()
  for (const row of rows) {
    if (!map.has(row.member.id) || row.translation.locale === locale) {
      map.set(row.member.id, {
        id: row.member.id,
        name: row.member.name,
        role: row.translation.role,
        bio: row.translation.bio,
        email: row.member.email,
        linkedinUrl: row.member.linkedinUrl,
        photo: row.member.photoId ? (photos.get(row.member.photoId) ?? null) : null,
      })
    }
  }
  return [...map.values()]
}

export async function listTestimonials(locale: Locale, ids?: string[]) {
  const conditions = [eq(testimonials.isPublished, true)]
  if (ids && ids.length > 0) conditions.push(inArray(testimonials.id, ids))

  const rows = await db
    .select({ testimonial: testimonials, translation: testimonialTranslations })
    .from(testimonials)
    .innerJoin(
      testimonialTranslations,
      eq(testimonialTranslations.testimonialId, testimonials.id),
    )
    .where(and(...conditions, localeFilter(testimonialTranslations.locale, locale)))
    .orderBy(testimonials.sortOrder)

  const photos = await getMediaByIds(
    rows.map((row) => row.testimonial.photoId).filter(Boolean) as string[],
  )

  const map = new Map<
    string,
    {
      id: string
      authorName: string
      organisation: string | null
      role: string | null
      quote: string
      photo: MediaRow | null
    }
  >()
  for (const row of rows) {
    if (!map.has(row.testimonial.id) || row.translation.locale === locale) {
      map.set(row.testimonial.id, {
        id: row.testimonial.id,
        authorName: row.testimonial.authorName,
        organisation: row.testimonial.organisation,
        role: row.translation.role,
        quote: row.translation.quote,
        photo: row.testimonial.photoId ? (photos.get(row.testimonial.photoId) ?? null) : null,
      })
    }
  }
  return [...map.values()]
}

export { media }
