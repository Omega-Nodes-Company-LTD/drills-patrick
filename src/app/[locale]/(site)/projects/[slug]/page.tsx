import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { buildAlternates, localeUrl, pathsFromTranslations } from '@/lib/seo'
import { sectionBreadcrumb, waterPointNode, webPageNode } from '@/lib/seo/nodes'
import { JsonLd } from '@/components/seo/json-ld'
import { notFound } from 'next/navigation'
import { permanentRedirect } from '@/i18n/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MediaImage } from '@/components/ui/media-image'
import { Progress } from '@/components/ui/progress'
import { ProjectCard } from '@/components/site/cards'
import { BeforeAfter } from '@/components/site/before-after'
import { ReadingsChart } from '@/components/site/readings-chart'
import { intlLocale, type Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { getProjectBySlug, listProjects } from '@/lib/content/queries'
import { listReadings } from '@/lib/transparency/registry'
import { formatMoney, formatNumber } from '@/lib/money'
import { sanitizeHtml } from '@/lib/sanitize'
import { percentage } from '@/lib/utils'
import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'

const statusVariant = { planned: 'outline', in_progress: 'warning', completed: 'success' } as const

function formatDate(value: string | null, locale: Locale) {
  if (!value) return null
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  const result = await getProjectBySlug(slug, locale)
  if (!result) return {}

  const settings = await getSiteSettings()

  const image = mediaUrl(result.cover?.objectKey)

  return {
    title: result.translation?.seoTitle || result.translation?.title,
    description: result.translation?.seoDescription || result.translation?.summary || undefined,
    // Own canonical: without it the page would inherit the locale layout's,
    // which points at the home page.
    alternates: buildAlternates({
      locale,
      paths: pathsFromTranslations(result.translations, '/projects'),
      enabledLocales: settings.enabledLocales,
    }),
    openGraph: {
      type: 'article',
      modifiedTime: result.project.updatedAt.toISOString(),
      title: result.translation?.title,
      description: result.translation?.summary ?? undefined,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  setRequestLocale(locale)

  const result = await getProjectBySlug(slug, locale)
  if (!result) notFound()

  // Either the slug belongs to another language or it is one the entity
  // used to live at. Permanent, not temporary: the old URL is not coming
  // back, and 308 is what moves a search engine's index and its authority.
  if (result.redirectTo) permanentRedirect({ href: `/projects/${result.redirectTo}`, locale })

  const t = await getTranslations('projects')
  const tNav = await getTranslations('nav')
  const { project, translation, cover, gallery, updates, campaignId } = result

  const [related, readings] = await Promise.all([
    listProjects({ locale, limit: 3 }),
    listReadings(project.id),
  ])
  const others = related.items.filter((item) => item.id !== project.id).slice(0, 3)

  const facts: { label: string; value: string }[] = []
  const push = (label: string, value: string | number | null | undefined, suffix = '') => {
    if (value === null || value === undefined || value === '' || value === 0) return
    facts.push({ label, value: `${value}${suffix}` })
  }

  push(t('facts.beneficiaries'), formatNumber(project.beneficiaries, locale))
  push(t('facts.households'), project.households ? formatNumber(project.households, locale) : null)
  push(t('facts.wells'), project.wellsCount)
  push(t('facts.depth'), project.depthMeters, ` ${t('units.metres')}`)
  push(t('facts.yield'), project.yieldLitersPerHour, ` ${t('units.litresPerHour')}`)
  push(t('facts.schools'), project.schoolsServed)
  push(t('facts.healthFacilities'), project.healthFacilitiesServed)
  push(t('facts.started'), formatDate(project.startDate, locale))
  push(
    project.completionDate ? t('facts.completed') : t('facts.plannedCompletion'),
    formatDate(project.completionDate ?? project.plannedCompletionDate, locale),
  )
  push(t('facts.quality'), project.waterQualityNote)

  const fundingProgress =
    project.budgetAmount && project.budgetAmount > 0
      ? percentage(project.fundedAmount, project.budgetAmount)
      : null

  const url = localeUrl(locale, `/projects/${translation?.slug ?? slug}`)

  return (
    <article>
      <JsonLd
        nodes={[
          webPageNode({
            locale,
            url,
            name: translation?.title ?? '',
            description: translation?.summary,
            dateModified: project.updatedAt,
            speakable: true,
          }),
          sectionBreadcrumb({
            locale,
            homeName: tNav('home'),
            section: { name: tNav('projects'), path: '/projects' },
            pageName: translation?.title ?? '',
            pageUrl: url,
          }),
          waterPointNode({
            url,
            name: translation?.title ?? '',
            description: translation?.summary,
            typeLabel: t(`type.${project.waterPointType}`),
            latitude: project.latitude,
            longitude: project.longitude,
            country: project.country,
            region: project.region,
            district: project.district,
            village: project.village,
            depthMeters: project.depthMeters,
            yieldLitersPerHour: project.yieldLitersPerHour,
            beneficiaries: project.beneficiaries,
            image: mediaUrl(cover?.objectKey) || null,
          }),
        ]}
      />
      <div className="relative isolate">
        <div className="relative aspect-[16/9] max-h-[28rem] w-full overflow-hidden bg-muted md:aspect-[21/9]">
          <MediaImage media={cover} locale={locale} priority sizes="100vw" />
        </div>

        <div className="container-page -mt-10 md:-mt-16">
          <div className="rounded-[var(--radius-xl)] border border-border bg-background p-6 shadow-token md:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={statusVariant[project.status]}>{t(`status.${project.status}`)}</Badge>
              <Badge variant="outline">{t(`type.${project.waterPointType}`)}</Badge>
              {project.district ? (
                <span className="text-sm text-muted-foreground">
                  {[project.village, project.district, project.region, project.country]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-title">{translation?.title}</h1>
            {translation?.summary ? (
              <p data-speakable className="mt-3 max-w-3xl text-lg text-muted-foreground">
                {translation.summary}
              </p>
            ) : null}

            {fundingProgress !== null ? (
              <div className="mt-6 flex max-w-md flex-col gap-2">
                <Progress value={fundingProgress} label={t('facts.funded')} />
                <p className="text-sm text-muted-foreground">
                  {formatMoney(project.fundedAmount, project.currency, locale, {
                    hideDecimals: true,
                  })}{' '}
                  / {formatMoney(project.budgetAmount!, project.currency, locale, { hideDecimals: true })}
                </p>
              </div>
            ) : null}

            {campaignId ? (
              <Button asChild size="lg" className="mt-6">
                <Link href={`/donate?campaign=${campaignId}`}>{t('supportThisProject')}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-16">
        <div className="flex flex-col gap-10">
          {translation?.contentHtml ? (
            <div
              className="prose-content max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(translation.contentHtml) }}
            />
          ) : null}

          <BeforeAfter
            locale={locale}
            walk={{ before: project.preWalkMinutes, after: project.postWalkMinutes }}
            queue={{ before: project.preQueueMinutes, after: project.postQueueMinutes }}
          />

          <ReadingsChart readings={readings} locale={locale} />

          {gallery.length > 0 ? (
            <section>
              <h2 className="mb-4 text-heading">{t('gallery')}</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {gallery.map((item) => (
                  <figure
                    key={item.id}
                    className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-muted"
                  >
                    <MediaImage
                      media={item}
                      locale={locale}
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {updates.length > 0 ? (
            <section>
              <h2 className="mb-6 text-heading">{t('timeline')}</h2>
              <ol className="relative flex flex-col gap-8 border-s border-border ps-6">
                {updates.map((update) => (
                  <li key={update.id} className="relative">
                    <span
                      className="absolute -start-[1.90rem] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background"
                      aria-hidden
                    />
                    <time className="text-small font-medium text-muted-foreground">
                      {formatDate(update.happenedOn, locale)}
                    </time>
                    <h3 className="mt-1 text-subheading font-semibold">
                      {update.translation?.title}
                    </h3>
                    {update.translation?.body ? (
                      <p className="mt-1 text-muted-foreground">{update.translation.body}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        {facts.length > 0 ? (
          <aside className="h-fit rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-surface-foreground lg:sticky lg:top-24">
            <h2 className="mb-4 text-subheading font-semibold">{t('facts.title')}</h2>
            <dl className="flex flex-col gap-3 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="text-end font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}
      </div>

      {others.length > 0 ? (
        <section className="border-t border-border bg-surface py-12 text-surface-foreground">
          <div className="container-page">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-heading">{t('relatedProjects')}</h2>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                {t('backToProjects')}
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((item) => (
                <ProjectCard key={item.id} project={item} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  )
}
