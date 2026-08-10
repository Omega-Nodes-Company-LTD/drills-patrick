import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { ProjectForm } from '@/components/admin/project-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, settings] = await Promise.all([getTranslations('admin.nav'), getSiteSettings()])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('projects')} />
      <ProjectForm currencies={settings.donations.currencies} storageEnabled={features.storage} />
    </div>
  )
}
