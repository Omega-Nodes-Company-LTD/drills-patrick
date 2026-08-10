import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { PostForm } from '@/components/admin/post-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminCategoryOptions, adminTagOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function NewPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, categories, tags] = await Promise.all([
    getTranslations('admin.nav'),
    adminCategoryOptions(),
    adminTagOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('posts')} />
      <PostForm categories={categories} tags={tags} storageEnabled={features.storage} />
    </div>
  )
}
