import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { FaultReportForm } from '@/components/site/fault-report-form'
import type { Locale } from '@/i18n/config'
import { projectForFaultReport } from '@/lib/ngo/faults'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const t = await getTranslations({ locale, namespace: 'report' })

  // One page per water point, all near-identical: useful to a person holding
  // a phone in front of a QR sticker, useless in an index.
  return { title: t('title'), robots: { index: false, follow: true } }
}

export default async function ReportFaultPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  setRequestLocale(locale)

  const [t, resolved] = await Promise.all([
    getTranslations('report'),
    projectForFaultReport(slug, locale),
  ])

  if (!resolved) notFound()

  return (
    <div className="container-narrow py-12">
      <h1 className="text-title">{t('title')}</h1>
      <p className="mb-2 mt-2 text-muted-foreground">{t('intro')}</p>
      <p className="mb-8 font-medium">
        {resolved.title}
        {resolved.project.village ? ` — ${resolved.project.village}` : ''}
      </p>

      <FaultReportForm projectId={resolved.project.id} />
    </div>
  )
}
