import { Plus } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { EntityList } from '@/components/admin/entity-list'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { adminListCampaigns } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { formatMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, tCommon, rows] = await Promise.all([
    getTranslations('admin.nav'),
    getTranslations('admin.common'),
    adminListCampaigns(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t('campaigns')}
        actions={
          <Button asChild>
            <Link href="/admin/campaigns/new">
              <Plus className="size-4" aria-hidden />
              {tCommon('newItem')}
            </Link>
          </Button>
        }
      />

      <EntityList
        type="campaign"
        locale={locale}
        emptyMessage={tCommon('noItems')}
        rows={rows.map((row) => {
          const currency = String(row.extra?.currency ?? 'EUR')
          return {
            id: row.id,
            title: row.title,
            status: row.status,
            updatedAt: row.updatedAt.toISOString(),
            translatedLocales: row.translatedLocales,
            meta: `${formatMoney(Number(row.extra?.raised ?? 0), currency, locale, {
              hideDecimals: true,
            })} / ${formatMoney(Number(row.extra?.goal ?? 0), currency, locale, { hideDecimals: true })}`,
            editHref: `/admin/campaigns/${row.id}`,
          }
        })}
      />
    </div>
  )
}
