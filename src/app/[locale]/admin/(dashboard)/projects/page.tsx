import { Download, Plus } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { EntityList } from '@/components/admin/entity-list'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { adminListProjects } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, tCommon, tProjects, rows] = await Promise.all([
    getTranslations('admin.nav'),
    getTranslations('admin.common'),
    getTranslations('projects'),
    adminListProjects(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t('projects')}
        actions={
          <div className="flex flex-wrap gap-2">
            {/* A plain link, not a client action: the browser downloads the
                file straight from the endpoint. */}
            <Button asChild variant="outline">
              <a href={`/api/admin/export?locale=${locale}`} download>
                <Download className="size-4" aria-hidden />
                {tCommon('export')}
              </a>
            </Button>
            <Button asChild>
              <Link href="/admin/projects/new">
                <Plus className="size-4" aria-hidden />
                {tCommon('newItem')}
              </Link>
            </Button>
          </div>
        }
      />

      <EntityList
        type="project"
        locale={locale}
        emptyMessage={tCommon('noItems')}
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          updatedAt: row.updatedAt.toISOString(),
          translatedLocales: row.translatedLocales,
          meta: [
            row.extra?.phase ? tProjects(`status.${row.extra.phase}`) : null,
            row.extra?.district,
          ]
            .filter(Boolean)
            .join(' · '),
          editHref: `/admin/projects/${row.id}`,
        }))}
      />
    </div>
  )
}
