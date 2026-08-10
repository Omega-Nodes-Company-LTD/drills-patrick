import { FileText, MapPin, TriangleAlert, Users } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requirePartner } from '@/app/actions/partner'
import { PortalHeader } from '@/components/portal/portal-header'
import { Badge } from '@/components/ui/badge'
import { MediaImage } from '@/components/ui/media-image'
import type { Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { formatNumber } from '@/lib/money'
import { listPortalProjects } from '@/lib/ngo/portal'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } }
}

export default async function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const session = await requirePartner(locale)
  const [t, tProjects, projects] = await Promise.all([
    getTranslations('portal'),
    getTranslations('projects'),
    listPortalProjects(session.partnerId, locale),
  ])

  const totals = projects.reduce(
    (acc, project) => ({
      beneficiaries: acc.beneficiaries + project.beneficiaries,
      documents: acc.documents + project.documentCount,
      faults: acc.faults + project.openFaults,
    }),
    { beneficiaries: 0, documents: 0, faults: 0 },
  )

  return (
    <div className="container-page py-10">
      <PortalHeader session={session} locale={locale} active="projects" />

      <dl className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: MapPin, label: t('projectsCount'), value: formatNumber(projects.length, locale) },
          {
            icon: Users,
            label: tProjects('facts.beneficiaries'),
            value: formatNumber(totals.beneficiaries, locale),
          },
          { icon: FileText, label: t('documents'), value: formatNumber(totals.documents, locale) },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5"
          >
            <item.icon className="size-6 text-primary" aria-hidden />
            <div>
              <dt className="text-small text-muted-foreground">{item.label}</dt>
              <dd className="text-heading">{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {projects.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-muted-foreground">
          {t('noProjects')}
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
            >
              <div className="relative aspect-16/9">
                <MediaImage media={project.cover} locale={locale} alt={project.title} />
              </div>

              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="font-heading text-base font-semibold">{project.title}</h2>
                <p className="text-small text-muted-foreground">
                  {[project.village, project.district].filter(Boolean).join(', ')}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  <Badge variant="outline">{tProjects(`status.${project.status}`)}</Badge>
                  {project.documentCount > 0 ? (
                    <Badge variant="primary">
                      <FileText className="size-3.5" aria-hidden />
                      {project.documentCount}
                    </Badge>
                  ) : null}
                  {project.openFaults > 0 ? (
                    <Badge variant="danger">
                      <TriangleAlert className="size-3.5" aria-hidden />
                      {project.openFaults}
                    </Badge>
                  ) : null}
                </div>

                <Link
                  href={`/portal/documents?project=${project.id}`}
                  className="text-small font-medium text-primary hover:underline"
                >
                  {t('viewDocuments')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
