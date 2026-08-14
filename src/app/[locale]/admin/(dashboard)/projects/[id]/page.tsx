import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { ProjectForm } from '@/components/admin/project-form'
import { MaintenanceVisitsEditor } from '@/components/admin/maintenance-visits-editor'
import { ReadingsEditor } from '@/components/admin/readings-editor'
import { ProjectDocumentsEditor } from '@/components/admin/project-documents-editor'
import { ProjectUpdatesEditor } from '@/components/admin/project-updates-editor'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import {
  adminGetProject,
  adminListMaintenanceVisits,
  adminListProjectDocuments,
  adminListReadings,
  adminListProjectUpdates,
} from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { fromMinorUnits } from '@/lib/money'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

const text = (value: number | string | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string }
  setRequestLocale(locale)
  await requirePermission('projects')

  const [t, record, settings, updates, documents, visits, readings] = await Promise.all([
    getTranslations('admin.nav'),
    adminGetProject(id),
    getSiteSettings(),
    adminListProjectUpdates(id),
    adminListProjectDocuments(id),
    adminListMaintenanceVisits(id),
    adminListReadings(id),
  ])

  if (!record) notFound()

  const { project } = record

  const translations = Object.fromEntries(
    record.translations.map((translation) => [
      translation.locale,
      {
        title: translation.title,
        slug: translation.slug,
        summary: translation.summary ?? '',
        contentHtml: translation.contentHtml,
        seoTitle: translation.seoTitle ?? '',
        seoDescription: translation.seoDescription ?? '',
      },
    ]),
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('projects')} />
      <ProjectForm
        currencies={settings.donations.currencies}
        storageEnabled={features.storage}
        initial={{
          id: project.id,
          coverId: project.coverId,
          status: project.status,
          publishStatus: project.publishStatus,
          isFeatured: project.isFeatured,
          waterPointType: project.waterPointType,
          country: project.country,
          region: text(project.region),
          district: text(project.district),
          village: text(project.village),
          latitude: text(project.latitude),
          longitude: text(project.longitude),
          wellsCount: text(project.wellsCount),
          depthMeters: text(project.depthMeters),
          yieldLitersPerHour: text(project.yieldLitersPerHour),
          waterQualityNote: text(project.waterQualityNote),
          preWalkMinutes: text(project.preWalkMinutes),
          postWalkMinutes: text(project.postWalkMinutes),
          preQueueMinutes: text(project.preQueueMinutes),
          postQueueMinutes: text(project.postQueueMinutes),
          beneficiaries: text(project.beneficiaries),
          households: text(project.households),
          schoolsServed: text(project.schoolsServed),
          healthFacilitiesServed: text(project.healthFacilitiesServed),
          startDate: text(project.startDate),
          completionDate: text(project.completionDate),
          plannedCompletionDate: text(project.plannedCompletionDate),
          budgetAmount:
            project.budgetAmount != null
              ? String(fromMinorUnits(project.budgetAmount, project.currency))
              : '',
          fundedAmount: String(fromMinorUnits(project.fundedAmount, project.currency)),
          currency: project.currency,
          galleryIds: project.galleryIds ?? [],
          sortOrder: text(project.sortOrder),
          translations,
        }}
      />

      <ProjectUpdatesEditor
        projectId={project.id}
        enabledLocales={settings.enabledLocales}
        storageEnabled={features.storage}
        rows={updates.map((update) => ({
          id: update.id,
          projectId: project.id,
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

      <ProjectDocumentsEditor
        projectId={project.id}
        storageEnabled={features.storage}
        rows={documents.map((document) => ({
          id: document.id,
          mediaId: document.mediaId,
          kind: document.kind,
          title: document.title,
          description: document.description,
          issuedOn: document.issuedOn,
          expiresOn: document.expiresOn,
          isPublic: document.isPublic,
        }))}
      />

      <MaintenanceVisitsEditor
        projectId={project.id}
        rows={visits.map((visit) => ({
          id: visit.id,
          kind: visit.kind,
          visitedOn: visit.visitedOn,
          technician: visit.technician,
          findings: visit.findings,
          workDone: visit.workDone,
          partsUsed: visit.partsUsed,
          functionalAfter: visit.functionalAfter,
        }))}
      />

      <ReadingsEditor
        projectId={project.id}
        rows={readings.map((reading) => ({
          id: reading.id,
          measuredOn: reading.measuredOn,
          yieldLitersPerHour: reading.yieldLitersPerHour,
          staticLevelM: reading.staticLevelM,
          note: reading.note,
          measuredBy: reading.measuredBy,
        }))}
      />
    </div>
  )
}
