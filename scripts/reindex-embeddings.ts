/* eslint-disable no-console */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, sqlClient } from '@/db'
import {
  campaignTranslations,
  campaigns,
  faqTranslations,
  faqs,
  postTranslations,
  posts,
  projectTranslations,
  projects,
} from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { isEmbeddingsEnabled } from '@/lib/embeddings/client'
import { indexDocument } from '@/lib/embeddings/indexer'

/**
 * Rebuilds the vector index for every published document.
 *
 * Run after enabling embeddings on an existing installation, or after changing
 * the embedding model. Unchanged chunks are skipped, so re-running is cheap.
 */
async function main() {
  if (!isEmbeddingsEnabled()) {
    console.log('EMBEDDINGS_API_KEY is not set — nothing to index.')
    return
  }

  let indexed = 0
  let chunks = 0

  const postRows = await db
    .select({
      id: posts.id,
      locale: postTranslations.locale,
      slug: postTranslations.slug,
      title: postTranslations.title,
      body: postTranslations.contentHtml,
      excerpt: postTranslations.excerpt,
    })
    .from(posts)
    .innerJoin(postTranslations, eq(postTranslations.postId, posts.id))
    .where(eq(posts.status, 'published'))

  for (const row of postRows) {
    chunks += await indexDocument({
      entityType: 'post',
      entityId: row.id,
      locale: row.locale as Locale,
      title: row.title,
      url: `/${row.locale}/blog/${row.slug}`,
      body: `${row.excerpt ?? ''}\n${row.body}`,
    })
    indexed += 1
  }

  const projectRows = await db
    .select({
      id: projects.id,
      locale: projectTranslations.locale,
      slug: projectTranslations.slug,
      title: projectTranslations.title,
      body: projectTranslations.contentHtml,
      summary: projectTranslations.summary,
    })
    .from(projects)
    .innerJoin(projectTranslations, eq(projectTranslations.projectId, projects.id))
    .where(eq(projects.publishStatus, 'published'))

  for (const row of projectRows) {
    chunks += await indexDocument({
      entityType: 'project',
      entityId: row.id,
      locale: row.locale as Locale,
      title: row.title,
      url: `/${row.locale}/projects/${row.slug}`,
      body: `${row.summary ?? ''}\n${row.body}`,
    })
    indexed += 1
  }

  const campaignRows = await db
    .select({
      id: campaigns.id,
      locale: campaignTranslations.locale,
      slug: campaignTranslations.slug,
      title: campaignTranslations.title,
      body: campaignTranslations.contentHtml,
      summary: campaignTranslations.summary,
    })
    .from(campaigns)
    .innerJoin(campaignTranslations, eq(campaignTranslations.campaignId, campaigns.id))
    .where(eq(campaigns.status, 'published'))

  for (const row of campaignRows) {
    chunks += await indexDocument({
      entityType: 'campaign',
      entityId: row.id,
      locale: row.locale as Locale,
      title: row.title,
      url: `/${row.locale}/campaigns/${row.slug}`,
      body: `${row.summary ?? ''}\n${row.body}`,
    })
    indexed += 1
  }

  const faqRows = await db
    .select({
      id: faqs.id,
      locale: faqTranslations.locale,
      question: faqTranslations.question,
      answer: faqTranslations.answerHtml,
    })
    .from(faqs)
    .innerJoin(faqTranslations, eq(faqTranslations.faqId, faqs.id))
    .where(eq(faqs.isPublished, true))

  for (const row of faqRows) {
    chunks += await indexDocument({
      entityType: 'faq',
      entityId: row.id,
      locale: row.locale as Locale,
      title: row.question,
      // Anchored, so a result opens the answer rather than the top of the page.
      url: `/${row.locale}/faq#${row.id}`,
      body: row.answer,
    })
    indexed += 1
  }

  console.log(`Indexed ${indexed} documents, ${chunks} chunks re-embedded.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => sqlClient.end())
