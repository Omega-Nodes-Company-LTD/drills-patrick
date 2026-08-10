import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { CategoriesManager } from '@/components/admin/categories-manager'
import type { Locale } from '@/i18n/config'
import { adminCategoriesWithTranslations } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, rows] = await Promise.all([
    getTranslations('admin.nav'),
    adminCategoriesWithTranslations(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('categories')} />
      <CategoriesManager
        rows={rows.map(({ category, translations }) => ({
          id: category.id,
          color: category.color,
          sortOrder: category.sortOrder,
          names: Object.fromEntries(
            translations.map((translation) => [translation.locale, translation.name]),
          ),
        }))}
      />
    </div>
  )
}
