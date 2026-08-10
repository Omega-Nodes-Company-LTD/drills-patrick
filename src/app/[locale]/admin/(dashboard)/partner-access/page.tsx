import { eq } from 'drizzle-orm'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { PartnerAccessManager } from '@/components/admin/partner-access-manager'
import { db } from '@/db'
import { ngoContacts, partnerProjects, partners } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { adminProjectOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminPartnerAccessPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('users')

  const [t, rows, partnerRows, projects, links] = await Promise.all([
    getTranslations('admin.partnerAccess'),
    db
      .select({ contact: ngoContacts, partnerName: partners.name })
      .from(ngoContacts)
      .innerJoin(partners, eq(partners.id, ngoContacts.partnerId))
      .orderBy(partners.name, ngoContacts.name),
    db.select({ id: partners.id, name: partners.name }).from(partners).orderBy(partners.name),
    adminProjectOptions(),
    db.select().from(partnerProjects),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <PartnerAccessManager
        partners={partnerRows}
        projects={projects}
        partnerProjects={links.map((link) => ({
          partnerId: link.partnerId,
          projectId: link.projectId,
        }))}
        contacts={rows.map(({ contact, partnerName }) => ({
          id: contact.id,
          partnerId: contact.partnerId,
          partnerName,
          email: contact.email,
          name: contact.name,
          role: contact.role,
          phone: contact.phone,
          locale: contact.locale,
          reportFrequency: contact.reportFrequency,
          isActive: contact.isActive,
          lastLoginAt: contact.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </div>
  )
}
