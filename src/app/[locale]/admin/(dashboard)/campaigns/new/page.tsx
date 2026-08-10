import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { CampaignForm } from '@/components/admin/campaign-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminProjectOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, settings, projects] = await Promise.all([
    getTranslations('admin.nav'),
    getSiteSettings(),
    adminProjectOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('campaigns')} />
      <CampaignForm
        currencies={settings.donations.currencies}
        projects={projects}
        storageEnabled={features.storage}
      />
    </div>
  )
}
