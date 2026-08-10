import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MediaLibrary } from '@/components/admin/media/media-library'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('media')

  const t = await getTranslations('admin.media')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title">{t('title')}</h1>
      <MediaLibrary storageEnabled={features.storage} />
    </div>
  )
}
