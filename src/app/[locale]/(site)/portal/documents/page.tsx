import { Download, FileText, PenLine } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requirePartner } from '@/app/actions/partner'
import { PortalHeader } from '@/components/portal/portal-header'
import { SignaturePad } from '@/components/portal/signature-pad'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'
import { intlLocale } from '@/i18n/config'
import { listPortalDocuments, listPortalProjects } from '@/lib/ngo/portal'
import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } }
}

const KINDS = [
  'water_quality',
  'drilling_log',
  'handover',
  'commissioning',
  'contract',
  'report',
  'other',
] as const

export default async function PortalDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ project?: string; kind?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const session = await requirePartner(locale)
  const query = await searchParams

  const kind = KINDS.includes(query.kind as (typeof KINDS)[number]) ? query.kind : undefined

  const [t, tDocs, projects, documents] = await Promise.all([
    getTranslations('portal'),
    getTranslations('documents'),
    listPortalProjects(session.partnerId, locale),
    listPortalDocuments(session.partnerId, locale, { projectId: query.project, kind }),
  ])

  const today = new Date().toISOString().slice(0, 10)

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00Z`))

  return (
    <div className="container-page py-10">
      <PortalHeader session={session} locale={locale} active="documents" />

      {/*
        The shared `Select` is used rather than a bare `<select>`: it carries the
        44px height and the 16px font size that stops iOS zooming the viewport on
        focus. Each control is full width on a phone and capped from `sm`, since
        a `<select>` is as wide as its longest option and `flex-wrap` cannot
        rescue an item that is itself wider than the viewport.
      */}
      <form className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap" method="get">
        <Select
          name="project"
          defaultValue={query.project ?? ''}
          className="sm:w-56"
          aria-label={t('projects')}
        >
          <option value="">{t('allProjects')}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </Select>

        <Select
          name="kind"
          defaultValue={kind ?? ''}
          className="sm:w-48"
          aria-label={t('documents')}
        >
          <option value="">{t('allKinds')}</option>
          {KINDS.map((entry) => (
            <option key={entry} value={entry}>
              {tDocs(`kinds.${entry}`)}
            </option>
          ))}
        </Select>

        <Button type="submit" className="sm:w-auto">
          {t('documents')}
        </Button>
      </form>

      {documents.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-muted-foreground">
          {t('noDocuments')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => {
            const url = mediaUrl(document.file?.objectKey)
            const expired = document.expiresOn ? document.expiresOn < today : false

            return (
              <li
                key={document.id}
                className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4"
              >
                <FileText className="size-5 shrink-0 text-primary" aria-hidden />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{document.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {document.projectTitle} · {tDocs(`kinds.${document.kind}`)}
                    {document.issuedOn ? ` · ${t('issued')} ${formatDate(document.issuedOn)}` : ''}
                  </p>
                </div>

                {document.expiresOn ? (
                  <Badge variant={expired ? 'danger' : 'outline'}>
                    {expired ? t('expired') : `${t('expires')} ${formatDate(document.expiresOn)}`}
                  </Badge>
                ) : null}

                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-small font-medium text-primary hover:underline"
                  >
                    <Download className="size-4" aria-hidden />
                    {t('download')}
                  </a>
                ) : null}

                {document.signatures.length > 0 ? (
                  <ul className="w-full border-t border-border pt-3 text-xs text-muted-foreground">
                    {document.signatures.map((signature, index) => (
                      <li key={index} className="flex flex-wrap items-center gap-2">
                        <PenLine className="size-3.5" aria-hidden />
                        <span className="font-medium text-foreground">{signature.signerName}</span>
                        {signature.signerRole ? <span>{signature.signerRole}</span> : null}
                        <span>{signature.signedAt.slice(0, 10)}</span>
                        {signature.valid ? null : (
                          <Badge variant="warning">{t('signatureStale')}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : document.kind === 'handover' ? (
                  <div className="w-full">
                    <SignaturePad documentId={document.id} documentTitle={document.title} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
