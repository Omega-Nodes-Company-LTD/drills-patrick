import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { CollectionManager } from '@/components/admin/collection-manager'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { listCollection } from '@/lib/admin/collections'
import { requirePermission } from '@/lib/auth/guard'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminFaqsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, settings, items] = await Promise.all([
    getTranslations('admin.nav'),
    getSiteSettings(),
    listCollection('faq'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('faqs')} />
      <CollectionManager
        collectionKey="faq"
        items={items}
        enabledLocales={settings.enabledLocales}
        storageEnabled={features.storage}
      />
    </div>
  )
}
