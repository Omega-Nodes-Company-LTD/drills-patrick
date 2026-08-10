'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  campaignTranslations,
  campaigns,
  categories,
  categoryTranslations,
  pageTranslations,
  pages,
  postTags,
  postTranslations,
  posts,
  projectTranslations,
  projects,
} from '@/db/schema'
import { locales, type Locale } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { indexDocumentInBackground, removeDocument } from '@/lib/embeddings/indexer'
import { toMinorUnits } from '@/lib/money'
import { sanitizeHtml } from '@/lib/sanitize'
import { htmlToPlainText, readingMinutes, slugify, truncate } from '@/lib/utils'
import {
  campaignInputSchema,
  categoryInputSchema,
  pageInputSchema,
  postInputSchema,
  projectInputSchema,
} from '@/lib/validation/admin'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Save actions for every editorial entity.
 *
 * They share one shape: validate → sanitise HTML → upsert the base row →
 * replace the translations → refresh caches → (re)index for semantic search.
 * Indexing is fire-and-forget so a slow embedding provider never blocks a save.
 */

type TranslationInput = {
  title?: string
  slug?: string
  seoTitle?: string
  seoDescription?: string
  excerpt?: string
  summary?: string
  contentHtml?: string
}

/** Builds a unique slug, appending a counter when the locale already has it. */
async function uniqueSlug(
  table: 'post' | 'project' | 'campaign' | 'page',
  locale: Locale,
  candidate: string,
  entityId: string | undefined,
): Promise<string> {
  const base = slugify(candidate) || `${table}-${Date.now().toString(36)}`

  const lookup = {
    post: {
      table: postTranslations,
      slug: postTranslations.slug,
      locale: postTranslations.locale,
      parent: postTranslations.postId,
    },
    project: {
      table: projectTranslations,
      slug: projectTranslations.slug,
      locale: projectTranslations.locale,
      parent: projectTranslations.projectId,
    },
    campaign: {
      table: campaignTranslations,
      slug: campaignTranslations.slug,
      locale: campaignTranslations.locale,
      parent: campaignTranslations.campaignId,
    },
    page: {
      table: pageTranslations,
      slug: pageTranslations.slug,
      locale: pageTranslations.locale,
      parent: pageTranslations.pageId,
    },
  }[table]

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`

    const [clash] = await db
      .select({ parent: lookup.parent })
      .from(lookup.table)
      .where(and(eq(lookup.locale, locale), eq(lookup.slug, slug)))
      .limit(1)

    if (!clash || (entityId && clash.parent === entityId)) return slug
  }

  return `${base}-${Date.now().toString(36)}`
}

function filledLocales(translations: Record<string, TranslationInput | undefined>): Locale[] {
  return locales.filter((locale) => {
    const value = translations[locale]
    return Boolean(value && (value.title?.trim() || value.contentHtml?.trim()))
  })
}

function revalidateSite() {
  revalidatePath('/', 'layout')
}

// -------------------------------------------------------------------- posts

export async function savePost(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = postInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  const data = parsed.data
  const present = filledLocales(data.translations)
  if (present.length === 0) return { ok: false, error: 'missing_translation' }

  const primary = data.translations[present[0]!]!
  const minutes = readingMinutes(primary.contentHtml ?? '')
  const isPublishing = data.status === 'published'

  const values = {
    coverId: data.coverId ?? null,
    categoryId: data.categoryId ?? null,
    authorId: user.id,
    status: data.status,
    isFeatured: data.isFeatured,
    readingMinutes: minutes,
    publishedAt: isPublishing ? new Date() : null,
  }

  let postId = data.id

  if (postId) {
    const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1)
    if (!existing) return { ok: false, error: 'not_found' }

    await db
      .update(posts)
      .set({ ...values, publishedAt: existing.publishedAt ?? (isPublishing ? new Date() : null) })
      .where(eq(posts.id, postId))
  } else {
    const [created] = await db.insert(posts).values(values).returning({ id: posts.id })
    postId = created!.id
  }

  await db.delete(postTranslations).where(eq(postTranslations.postId, postId))

  for (const locale of present) {
    const translation = data.translations[locale]!
    const html = sanitizeHtml(translation.contentHtml ?? '')
    const slug = await uniqueSlug('post', locale, translation.slug || translation.title || '', postId)

    await db.insert(postTranslations).values({
      postId,
      locale,
      title: translation.title ?? '',
      slug,
      excerpt: translation.excerpt || truncate(htmlToPlainText(html), 200) || null,
      contentHtml: html,
      seoTitle: translation.seoTitle || null,
      seoDescription: translation.seoDescription || null,
    })

    if (data.status === 'published') {
      indexDocumentInBackground({
        entityType: 'post',
        entityId: postId,
        locale,
        title: translation.title ?? '',
        url: `/${locale}/blog/${slug}`,
        body: html,
      })
    }
  }

  if (data.status !== 'published') {
    await removeDocument('post', postId)
  }

  await db.delete(postTags).where(eq(postTags.postId, postId))
  if (data.tagIds.length > 0) {
    await db.insert(postTags).values(data.tagIds.map((tagId) => ({ postId: postId!, tagId })))
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'post.update' : 'post.create',
    entityType: 'post',
    entityId: postId,
    summary: primary.title,
  })

  revalidateSite()
  return { ok: true, data: { id: postId } }
}

// ------------------------------------------------------------------ projects

export async function saveProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = projectInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  const data = parsed.data
  const present = filledLocales(data.translations)
  if (present.length === 0) return { ok: false, error: 'missing_translation' }

  const currency = data.currency.toUpperCase()

  const values = {
    coverId: data.coverId ?? null,
    status: data.status,
    publishStatus: data.publishStatus,
    isFeatured: data.isFeatured,
    waterPointType: data.waterPointType,
    country: data.country,
    region: data.region || null,
    district: data.district || null,
    village: data.village || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    wellsCount: data.wellsCount,
    depthMeters: data.depthMeters ?? null,
    yieldLitersPerHour: data.yieldLitersPerHour ?? null,
    waterQualityNote: data.waterQualityNote || null,
    beneficiaries: data.beneficiaries,
    households: data.households ?? null,
    schoolsServed: data.schoolsServed ?? null,
    healthFacilitiesServed: data.healthFacilitiesServed ?? null,
    startDate: data.startDate || null,
    completionDate: data.completionDate || null,
    plannedCompletionDate: data.plannedCompletionDate || null,
    budgetAmount: data.budgetAmount != null ? toMinorUnits(data.budgetAmount, currency) : null,
    fundedAmount: toMinorUnits(data.fundedAmount, currency),
    currency,
    galleryIds: data.galleryIds,
    sortOrder: data.sortOrder,
    publishedAt: data.publishStatus === 'published' ? new Date() : null,
  }

  let projectId = data.id

  if (projectId) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    if (!existing) return { ok: false, error: 'not_found' }

    await db
      .update(projects)
      .set({
        ...values,
        publishedAt:
          existing.publishedAt ?? (data.publishStatus === 'published' ? new Date() : null),
      })
      .where(eq(projects.id, projectId))
  } else {
    const [created] = await db.insert(projects).values(values).returning({ id: projects.id })
    projectId = created!.id
  }

  await db.delete(projectTranslations).where(eq(projectTranslations.projectId, projectId))

  for (const locale of present) {
    const translation = data.translations[locale]!
    const html = sanitizeHtml(translation.contentHtml ?? '')
    const slug = await uniqueSlug(
      'project',
      locale,
      translation.slug || translation.title || '',
      projectId,
    )

    await db.insert(projectTranslations).values({
      projectId,
      locale,
      title: translation.title ?? '',
      slug,
      summary: translation.summary || truncate(htmlToPlainText(html), 200) || null,
      contentHtml: html,
      seoTitle: translation.seoTitle || null,
      seoDescription: translation.seoDescription || null,
    })

    if (data.publishStatus === 'published') {
      indexDocumentInBackground({
        entityType: 'project',
        entityId: projectId,
        locale,
        title: translation.title ?? '',
        url: `/${locale}/projects/${slug}`,
        body: `${translation.summary ?? ''}\n${html}`,
      })
    }
  }

  if (data.publishStatus !== 'published') {
    await removeDocument('project', projectId)
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'project.update' : 'project.create',
    entityType: 'project',
    entityId: projectId,
    summary: data.translations[present[0]!]?.title,
  })

  revalidateSite()
  return { ok: true, data: { id: projectId } }
}

// ----------------------------------------------------------------- campaigns

export async function saveCampaign(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = campaignInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const present = filledLocales(data.translations)
  if (present.length === 0) return { ok: false, error: 'missing_translation' }

  const currency = data.currency.toUpperCase()

  const values = {
    coverId: data.coverId ?? null,
    projectId: data.projectId ?? null,
    status: data.status,
    isFeatured: data.isFeatured,
    goalAmount: toMinorUnits(data.goalAmount, currency),
    offlineAmount: toMinorUnits(data.offlineAmount, currency),
    currency,
    startsOn: data.startsOn || null,
    endsOn: data.endsOn || null,
    suggestedAmounts: data.suggestedAmounts.map((amount) => toMinorUnits(amount, currency)),
    allowCustomAmount: data.allowCustomAmount,
    sortOrder: data.sortOrder,
    publishedAt: data.status === 'published' ? new Date() : null,
  }

  let campaignId = data.id

  if (campaignId) {
    await db.update(campaigns).set(values).where(eq(campaigns.id, campaignId))
  } else {
    const [created] = await db.insert(campaigns).values(values).returning({ id: campaigns.id })
    campaignId = created!.id
  }

  await db.delete(campaignTranslations).where(eq(campaignTranslations.campaignId, campaignId))

  for (const locale of present) {
    const translation = data.translations[locale]!
    const html = sanitizeHtml(translation.contentHtml ?? '')
    const slug = await uniqueSlug(
      'campaign',
      locale,
      translation.slug || translation.title || '',
      campaignId,
    )

    await db.insert(campaignTranslations).values({
      campaignId,
      locale,
      title: translation.title ?? '',
      slug,
      summary: translation.summary || truncate(htmlToPlainText(html), 200) || null,
      contentHtml: html,
      seoTitle: translation.seoTitle || null,
      seoDescription: translation.seoDescription || null,
    })

    if (data.status === 'published') {
      indexDocumentInBackground({
        entityType: 'campaign',
        entityId: campaignId,
        locale,
        title: translation.title ?? '',
        url: `/${locale}/campaigns/${slug}`,
        body: `${translation.summary ?? ''}\n${html}`,
      })
    }
  }

  if (data.status !== 'published') {
    await removeDocument('campaign', campaignId)
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'campaign.update' : 'campaign.create',
    entityType: 'campaign',
    entityId: campaignId,
    summary: data.translations[present[0]!]?.title,
  })

  revalidateSite()
  return { ok: true, data: { id: campaignId } }
}

// --------------------------------------------------------------------- pages

export async function savePage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = pageInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  const data = parsed.data
  const values = {
    key: data.key,
    status: data.status,
    showInSitemap: data.showInSitemap,
    blocks: data.blocks,
    publishedAt: data.status === 'published' ? new Date() : null,
  }

  let pageId = data.id

  if (pageId) {
    await db.update(pages).set(values).where(eq(pages.id, pageId))
  } else {
    const [created] = await db.insert(pages).values(values).returning({ id: pages.id })
    pageId = created!.id
  }

  await db.delete(pageTranslations).where(eq(pageTranslations.pageId, pageId))

  for (const locale of locales) {
    const translation = data.translations[locale]
    if (!translation?.title?.trim() && !translation?.slug?.trim()) continue

    const slug = await uniqueSlug('page', locale, translation.slug || translation.title || '', pageId)

    await db.insert(pageTranslations).values({
      pageId,
      locale,
      title: translation.title ?? '',
      slug,
      seoTitle: translation.seoTitle || null,
      seoDescription: translation.seoDescription || null,
    })
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'page.update' : 'page.create',
    entityType: 'page',
    entityId: pageId,
    summary: data.key,
  })

  revalidateSite()
  return { ok: true, data: { id: pageId } }
}

// ---------------------------------------------------------------- categories

export async function saveCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = categoryInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  let categoryId = data.id

  if (categoryId) {
    await db
      .update(categories)
      .set({ color: data.color || null, sortOrder: data.sortOrder })
      .where(eq(categories.id, categoryId))
  } else {
    const [created] = await db
      .insert(categories)
      .values({ color: data.color || null, sortOrder: data.sortOrder })
      .returning({ id: categories.id })
    categoryId = created!.id
  }

  await db.delete(categoryTranslations).where(eq(categoryTranslations.categoryId, categoryId))

  for (const locale of locales) {
    const translation = data.translations[locale]
    if (!translation?.name?.trim()) continue

    await db.insert(categoryTranslations).values({
      categoryId,
      locale,
      name: translation.name,
      slug: slugify(translation.slug || translation.name) || `${locale}-${Date.now().toString(36)}`,
    })
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'category.update' : 'category.create',
    entityType: 'category',
    entityId: categoryId,
  })

  revalidateSite()
  return { ok: true, data: { id: categoryId } }
}

// -------------------------------------------------------------------- delete

const DELETABLE = {
  post: { table: posts, permission: 'content' as const, entity: 'post' as const },
  project: { table: projects, permission: 'projects' as const, entity: 'project' as const },
  campaign: { table: campaigns, permission: 'content' as const, entity: 'campaign' as const },
  page: { table: pages, permission: 'content' as const, entity: 'page' as const },
  category: { table: categories, permission: 'content' as const, entity: null },
}

export async function deleteEntity(
  type: keyof typeof DELETABLE,
  id: string,
): Promise<ActionResult> {
  const config = DELETABLE[type]
  if (!config) return { ok: false, error: 'invalid' }

  const user = await requireApiUser(config.permission)
  if (!user) return { ok: false, error: 'unauthorised' }

  if (type === 'page') {
    const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
    if (page?.isSystem) return { ok: false, error: 'system_page' }
  }

  await db.delete(config.table).where(eq(config.table.id, id))

  if (config.entity) {
    await removeDocument(config.entity, id)
  }

  await recordAudit({ actor: user, action: `${type}.delete`, entityType: type, entityId: id })

  revalidateSite()
  return { ok: true }
}

/** Quick publish/unpublish from the listing screens. */
export async function setPublishStatus(
  type: 'post' | 'project' | 'campaign' | 'page',
  id: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionResult> {
  const user = await requireApiUser(type === 'project' ? 'projects' : 'content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const published = status === 'published'

  if (type === 'project') {
    await db
      .update(projects)
      .set({ publishStatus: status, publishedAt: published ? new Date() : null })
      .where(eq(projects.id, id))
  } else if (type === 'post') {
    await db
      .update(posts)
      .set({ status, publishedAt: published ? new Date() : null })
      .where(eq(posts.id, id))
  } else if (type === 'campaign') {
    await db
      .update(campaigns)
      .set({ status, publishedAt: published ? new Date() : null })
      .where(eq(campaigns.id, id))
  } else {
    await db
      .update(pages)
      .set({ status, publishedAt: published ? new Date() : null })
      .where(eq(pages.id, id))
  }

  if (!published && type !== 'page') {
    await removeDocument(type, id)
  }

  await recordAudit({
    actor: user,
    action: `${type}.status`,
    entityType: type,
    entityId: id,
    summary: status,
  })

  revalidateSite()
  return { ok: true }
}
