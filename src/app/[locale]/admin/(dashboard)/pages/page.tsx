import { Plus } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { EntityList } from '@/components/admin/entity-list'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { adminListPages } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminPagesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, tCommon, tBlocks, rows] = await Promise.all([
    getTranslations('admin.nav'),
    getTranslations('admin.common'),
    getTranslations('admin.blocks'),
    adminListPages(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t('pages')}
        actions={
          <Button asChild>
            <Link href="/admin/pages/new">
              <Plus className="size-4" aria-hidden />
              {tCommon('newItem')}
            </Link>
          </Button>
        }
      />

      <EntityList
        type="page"
        locale={locale}
        emptyMessage={tCommon('noItems')}
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title === '—' ? row.key : row.title,
          status: row.status,
          updatedAt: row.updatedAt.toISOString(),
          translatedLocales: row.translatedLocales,
          meta: `${row.key} · ${row.extra?.blocks ?? 0} ${tBlocks('title').toLowerCase()}`,
          editHref: `/admin/pages/${row.id}`,
          canDelete: !row.isSystem,
          canUnpublish: !row.isSystem,
        }))}
      />
    </div>
  )
}
