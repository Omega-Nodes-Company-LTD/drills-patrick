import { desc } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { ContractsManager } from '@/components/admin/contracts-manager'
import { db } from '@/db'
import { contractProjects, maintenanceContracts, partners } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { adminProjectOptions } from '@/lib/admin/queries'
import { fromMinorUnits } from '@/lib/money'
import { nextVisitDue } from '@/lib/ngo/portal'

export const dynamic = 'force-dynamic'

export default async function AdminContractsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, rows, partnerRows, projectOptions, links] = await Promise.all([
    getTranslations('admin.contracts'),
    db
      .select()
      .from(maintenanceContracts)
      .orderBy(desc(maintenanceContracts.isActive), desc(maintenanceContracts.startsOn)),
    db.select({ id: partners.id, name: partners.name }).from(partners).orderBy(partners.name),
    adminProjectOptions(),
    db.select().from(contractProjects),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <ContractsManager
        locale={locale}
        partners={partnerRows}
        projects={projectOptions}
        rows={rows.map((contract) => ({
          id: contract.id,
          partnerId: contract.partnerId,
          partnerName: partnerRows.find((p) => p.id === contract.partnerId)?.name ?? '—',
          reference: contract.reference,
          startsOn: contract.startsOn,
          endsOn: contract.endsOn,
          visitIntervalMonths: contract.visitIntervalMonths,
          fee: String(fromMinorUnits(contract.feeMinor, contract.currency)),
          currency: contract.currency,
          responseHours: contract.responseHours,
          isActive: contract.isActive,
          notes: contract.notes,
          projectIds: links
            .filter((link) => link.contractId === contract.id)
            .map((link) => link.projectId),
          nextVisitDue: nextVisitDue(contract.startsOn, contract.visitIntervalMonths),
        }))}
      />
    </div>
  )
}
