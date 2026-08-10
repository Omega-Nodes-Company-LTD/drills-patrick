import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { FaultsList } from '@/components/admin/faults-list'
import { SlaCards } from '@/components/admin/sla-cards'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { listFaults, slaMetrics } from '@/lib/ngo/faults'

export const dynamic = 'force-dynamic'

export default async function AdminFaultsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, faults, sla] = await Promise.all([
    getTranslations('admin.faults'),
    listFaults({ locale }),
    slaMetrics({ sinceDays: 365 }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />

      <SlaCards metrics={sla} locale={locale} />

      <FaultsList
        locale={locale}
        rows={faults.map((fault) => ({
          id: fault.id,
          reference: fault.reference,
          projectTitle: fault.projectTitle,
          description: fault.description,
          symptom: fault.symptom,
          status: fault.status,
          reporterName: fault.reporterName,
          reporterPhone: fault.reporterPhone,
          resolutionNote: fault.resolutionNote,
          createdAt: fault.createdAt.toISOString(),
          acknowledgedAt: fault.acknowledgedAt?.toISOString() ?? null,
          resolvedAt: fault.resolvedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
