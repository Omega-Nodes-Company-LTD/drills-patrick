import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { SettingsForm } from '@/components/admin/settings-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { providerStatuses } from '@/lib/payments/registry'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('settings')

  const [t, settings] = await Promise.all([getTranslations('admin.settings'), getSiteSettings()])

  const integrations = [
    { name: 'object storage', configured: features.storage, testable: 'storage' as const },
    { name: 'embeddings', configured: features.embeddings, testable: 'embeddings' as const },
    { name: 'chat assistant', configured: features.ragChat },
    { name: 'email', configured: features.mail, testable: 'mail' as const },
    ...providerStatuses().map((entry) => ({ name: entry.id, configured: entry.configured })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <SettingsForm
        initial={settings}
        storageEnabled={features.storage}
        integrations={integrations}
      />
    </div>
  )
}
