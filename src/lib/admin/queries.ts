import 'server-only'
import { desc, eq, inArray } from 'drizzle-orm'
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
  projectUpdateTranslations,
  maintenanceVisits,
  projectDocuments,
  projectUpdates,
  projects,
  teamMembers,
  tagTranslations,
  tags,
  waterPointReadings,
} from '@/db/schema'
import { defaultLocale, type Locale } from '@/i18n/config'
import { groupByParent, pickTranslation } from '@/lib/content/translations'

/**
 * Admin read models. Unlike the public queries these include drafts and expose
 * which languages are already translated.
 */

export type AdminListRow = {
  id: string
  title: string
  status: string
  updatedAt: Date
  translatedLocales: Locale[]
  extra?: Record<string, string | number | null>
}

function summarise<T extends { locale: string; title: string }>(
  translations: T[] | undefined,
): { title: string; translatedLocales: Locale[] } {
  const resolved = pickTranslation(translations, defaultLocale)
  return {
    title: resolved?.title || '—',
    translatedLocales: (translations ?? [])
      .filter((row) => row.title.trim().length > 0)
      .map((row) => row.locale as Locale),
  }
}

export async function adminListPosts(): Promise<AdminListRow[]> {
  const rows = await db.select().from(posts).orderBy(desc(posts.updatedAt))
  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(postTranslations)
    .where(
      inArray(
        postTranslations.postId,
        rows.map((row) => row.id),
      ),
    )
  const byPost = groupByParent(translations, 'postId')

  return rows.map((row) => ({
    id: row.id,
    ...summarise(byPost.get(row.id)),
    status: row.status,
    updatedAt: row.updatedAt,
    extra: { featured: row.isFeatured ? 1 : 0 },
  }))
}

export async function adminListProjects(): Promise<AdminListRow[]> {
  const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt))
  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(projectTranslations)
    .where(
      inArray(
        projectTranslations.projectId,
        rows.map((row) => row.id),
      ),
    )
  const byProject = groupByParent(translations, 'projectId')

  return rows.map((row) => ({
    id: row.id,
    ...summarise(byProject.get(row.id)),
    status: row.publishStatus,
    updatedAt: row.updatedAt,
    extra: { phase: row.status, district: row.district, beneficiaries: row.beneficiaries },
  }))
}

export async function adminListCampaigns(): Promise<AdminListRow[]> {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.updatedAt))
  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(campaignTranslations)
    .where(
      inArray(
        campaignTranslations.campaignId,
        rows.map((row) => row.id),
      ),
    )
  const byCampaign = groupByParent(translations, 'campaignId')

  return rows.map((row) => ({
    id: row.id,
    ...summarise(byCampaign.get(row.id)),
    status: row.status,
    updatedAt: row.updatedAt,
    extra: {
      goal: row.goalAmount,
      raised: row.raisedAmount + row.offlineAmount,
      currency: row.currency,
    },
  }))
}

export async function adminListPages(): Promise<(AdminListRow & { key: string; isSystem: boolean })[]> {
  const rows = await db.select().from(pages).orderBy(pages.key)
  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(pageTranslations)
    .where(
      inArray(
        pageTranslations.pageId,
        rows.map((row) => row.id),
      ),
    )
  const byPage = groupByParent(translations, 'pageId')

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    isSystem: row.isSystem,
    ...summarise(byPage.get(row.id)),
    status: row.status,
    updatedAt: row.updatedAt,
    extra: { blocks: (row.blocks ?? []).length },
  }))
}

// ------------------------------------------------------------------ editors

export async function adminGetPost(id: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  if (!post) return null

  const [translations, tagRows] = await Promise.all([
    db.select().from(postTranslations).where(eq(postTranslations.postId, id)),
    db.select({ tagId: postTags.tagId }).from(postTags).where(eq(postTags.postId, id)),
  ])

  return { post, translations, tagIds: tagRows.map((row) => row.tagId) }
}

export async function adminGetProject(id: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  if (!project) return null

  const translations = await db
    .select()
    .from(projectTranslations)
    .where(eq(projectTranslations.projectId, id))

  return { project, translations }
}

/** Documents attached to a project, in the order the office reads them. */
export async function adminListProjectDocuments(projectId: string) {
  return db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.projectId, projectId))
    .orderBy(desc(projectDocuments.issuedOn), desc(projectDocuments.createdAt))
}

/** Readings taken at a water point, most recent first. */
export async function adminListReadings(projectId: string) {
  return db
    .select()
    .from(waterPointReadings)
    .where(eq(waterPointReadings.projectId, projectId))
    .orderBy(desc(waterPointReadings.measuredOn))
}

/** Maintenance visits to a water point, most recent first. */
export async function adminListMaintenanceVisits(projectId: string) {
  return db
    .select()
    .from(maintenanceVisits)
    .where(eq(maintenanceVisits.projectId, projectId))
    .orderBy(desc(maintenanceVisits.visitedOn))
}

/** Team members who can carry a public byline on an article. */
export async function adminAuthorOptions() {
  const rows = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      credentials: teamMembers.credentials,
    })
    .from(teamMembers)
    .where(eq(teamMembers.isPublished, true))
    .orderBy(teamMembers.sortOrder)

  return rows
}

/** Timeline entries of a project, every language, published or not. */
/**
 * Every timeline entry on the installation, newest first.
 *
 * Updates could only be reached by opening the project that owns them, which
 * is the wrong way round for the work: entries arrive from the field in date
 * order, across whichever projects happen to be running that week.
 */
export async function adminListAllProjectUpdates(limit = 200) {
  const rows = await db
    .select({ update: projectUpdates })
    .from(projectUpdates)
    .orderBy(desc(projectUpdates.happenedOn), desc(projectUpdates.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  const updates = rows.map((row) => row.update)

  const translations = await db
    .select()
    .from(projectUpdateTranslations)
    .where(
      inArray(
        projectUpdateTranslations.updateId,
        updates.map((row) => row.id),
      ),
    )

  const byUpdate = groupByParent(translations, 'updateId')

  return updates.map((row) => ({
    ...row,
    translations: byUpdate.get(row.id) ?? [],
  }))
}

export async function adminListProjectUpdates(projectId: string) {
  const rows = await db
    .select()
    .from(projectUpdates)
    .where(eq(projectUpdates.projectId, projectId))
    .orderBy(desc(projectUpdates.happenedOn))

  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(projectUpdateTranslations)
    .where(
      inArray(
        projectUpdateTranslations.updateId,
        rows.map((row) => row.id),
      ),
    )

  const byUpdate = groupByParent(translations, 'updateId')

  return rows.map((row) => ({
    ...row,
    translations: byUpdate.get(row.id) ?? [],
  }))
}

export async function adminGetCampaign(id: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
  if (!campaign) return null

  const translations = await db
    .select()
    .from(campaignTranslations)
    .where(eq(campaignTranslations.campaignId, id))

  return { campaign, translations }
}

export async function adminGetPage(idOrKey: string) {
  const [page] = await db
    .select()
    .from(pages)
    .where(idOrKey.includes('-') && idOrKey.length > 20 ? eq(pages.id, idOrKey) : eq(pages.key, idOrKey))
    .limit(1)

  if (!page) return null

  const translations = await db
    .select()
    .from(pageTranslations)
    .where(eq(pageTranslations.pageId, page.id))

  return { page, translations }
}

// ------------------------------------------------------------- option lists

export async function adminCategoryOptions() {
  const rows = await db
    .select({ category: categories, translation: categoryTranslations })
    .from(categories)
    .leftJoin(categoryTranslations, eq(categoryTranslations.categoryId, categories.id))
    .orderBy(categories.sortOrder)

  const map = new Map<string, { id: string; name: string }>()
  for (const row of rows) {
    if (!map.has(row.category.id) || row.translation?.locale === defaultLocale) {
      map.set(row.category.id, {
        id: row.category.id,
        name: row.translation?.name ?? '—',
      })
    }
  }
  return [...map.values()]
}

export async function adminTagOptions() {
  const rows = await db
    .select({ tag: tags, translation: tagTranslations })
    .from(tags)
    .leftJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))

  const map = new Map<string, { id: string; name: string }>()
  for (const row of rows) {
    if (!map.has(row.tag.id) || row.translation?.locale === defaultLocale) {
      map.set(row.tag.id, { id: row.tag.id, name: row.translation?.name ?? '—' })
    }
  }
  return [...map.values()]
}

export async function adminProjectOptions() {
  const rows = await db
    .select({ id: projects.id, title: projectTranslations.title, locale: projectTranslations.locale })
    .from(projects)
    .leftJoin(projectTranslations, eq(projectTranslations.projectId, projects.id))

  const map = new Map<string, string>()
  for (const row of rows) {
    if (!map.has(row.id) || row.locale === defaultLocale) {
      map.set(row.id, row.title ?? '—')
    }
  }
  return [...map.entries()].map(([id, title]) => ({ id, title }))
}

export async function adminCategoriesWithTranslations() {
  const rows = await db.select().from(categories).orderBy(categories.sortOrder)
  if (rows.length === 0) return []

  const translations = await db
    .select()
    .from(categoryTranslations)
    .where(
      inArray(
        categoryTranslations.categoryId,
        rows.map((row) => row.id),
      ),
    )
  const byCategory = groupByParent(translations, 'categoryId')

  return rows.map((row) => ({ category: row, translations: byCategory.get(row.id) ?? [] }))
}
