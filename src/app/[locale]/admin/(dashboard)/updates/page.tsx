import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { FieldUpdatesManager } from '@/components/admin/field-updates-manager'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminListAllProjectUpdates, adminProjectOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AdminUpdatesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, settings, rows, projects] = await Promise.all([
    getTranslations('admin.nav'),
    getSiteSettings(),
    adminListAllProjectUpdates(),
    adminProjectOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('updates')} />
      <FieldUpdatesManager
        enabledLocales={settings.enabledLocales}
        storageEnabled={features.storage}
        projects={projects}
        rows={rows.map((update) => ({
          id: update.id,
          projectId: update.projectId,
          mediaId: update.mediaId,
          happenedOn: update.happenedOn,
          sortOrder: update.sortOrder,
          isPublished: update.isPublished,
          translations: Object.fromEntries(
            update.translations.map((translation) => [
              translation.locale,
              { title: translation.title, body: translation.body },
            ]),
          ),
        }))}
      />
    </div>
  )
}
