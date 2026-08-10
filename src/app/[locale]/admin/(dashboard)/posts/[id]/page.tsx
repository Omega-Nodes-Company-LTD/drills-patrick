import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { PostForm } from '@/components/admin/post-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import {
  adminAuthorOptions,
  adminCategoryOptions,
  adminGetPost,
  adminTagOptions,
} from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, record, categories, tags, authors] = await Promise.all([
    getTranslations('admin.nav'),
    adminGetPost(id),
    adminCategoryOptions(),
    adminTagOptions(),
    adminAuthorOptions(),
  ])

  if (!record) notFound()

  const translations = Object.fromEntries(
    record.translations.map((translation) => [
      translation.locale,
      {
        title: translation.title,
        slug: translation.slug,
        excerpt: translation.excerpt ?? '',
        contentHtml: translation.contentHtml,
        seoTitle: translation.seoTitle ?? '',
        seoDescription: translation.seoDescription ?? '',
      },
    ]),
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('posts')} />
      <PostForm
        initial={{
          id: record.post.id,
          coverId: record.post.coverId,
          categoryId: record.post.categoryId,
          authorMemberId: record.post.authorMemberId,
          status: record.post.status,
          isFeatured: record.post.isFeatured,
          tagIds: record.tagIds,
          translations,
        }}
        categories={categories}
        tags={tags}
        authors={authors}
        storageEnabled={features.storage}
      />
    </div>
  )
}
