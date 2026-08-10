import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { PageForm } from '@/components/admin/page-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminCategoryOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { listCampaigns } from '@/lib/content/queries'

export const dynamic = 'force-dynamic'

export default async function NewPagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, categories, campaigns] = await Promise.all([
    getTranslations('admin.nav'),
    adminCategoryOptions(),
    listCampaigns({ locale, limit: 50 }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('pages')} />
      <PageForm
        storageEnabled={features.storage}
        categories={categories}
        campaigns={campaigns.items.map((item) => ({ id: item.id, title: item.title }))}
      />
    </div>
  )
}
