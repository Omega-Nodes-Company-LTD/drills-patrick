import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { PageForm } from '@/components/admin/page-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminCategoryOptions, adminGetPage } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { parseBlocks } from '@/lib/blocks/schema'
import { listCampaigns } from '@/lib/content/queries'

export const dynamic = 'force-dynamic'

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, record, categories, campaigns] = await Promise.all([
    getTranslations('admin.nav'),
    adminGetPage(id),
    adminCategoryOptions(),
    listCampaigns({ locale, limit: 50 }),
  ])

  if (!record) notFound()

  const translations = Object.fromEntries(
    record.translations.map((translation) => [
      translation.locale,
      {
        title: translation.title,
        slug: translation.slug,
        seoTitle: translation.seoTitle ?? '',
        seoDescription: translation.seoDescription ?? '',
      },
    ]),
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={`${t('pages')} · ${record.page.key}`} />
      <PageForm
        storageEnabled={features.storage}
        categories={categories}
        campaigns={campaigns.items.map((item) => ({ id: item.id, title: item.title }))}
        initial={{
          id: record.page.id,
          key: record.page.key,
          status: record.page.status,
          showInSitemap: record.page.showInSitemap,
          isSystem: record.page.isSystem,
          blocks: parseBlocks(record.page.blocks ?? []),
          translations,
        }}
      />
    </div>
  )
}
