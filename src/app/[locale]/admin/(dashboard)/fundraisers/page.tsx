import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { FundraiserModeration } from '@/components/admin/fundraiser-moderation'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { adminListFundraisers } from '@/lib/giving/fundraisers'

export const dynamic = 'force-dynamic'

export default async function AdminFundraisersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, rows] = await Promise.all([getTranslations('admin.nav'), adminListFundraisers()])

  // Pending first: a page waiting for review is the only thing on this screen
  // that is costing someone something while nobody looks at it.
  const order = { pending: 0, approved: 1, rejected: 2, closed: 3 } as Record<string, number>
  const sorted = [...rows].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('fundraisers')} />
      <FundraiserModeration
        locale={locale}
        rows={sorted.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          ownerName: row.ownerName,
          ownerEmail: row.ownerEmail,
          story: row.story,
          status: row.status,
          moderationNote: row.moderationNote,
          raisedAmountMinor: row.raisedAmountMinor,
          goalAmountMinor: row.goalAmountMinor,
          currency: row.currency,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
