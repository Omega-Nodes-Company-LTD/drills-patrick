import { ArrowRight, CalendarDays, Droplets, MapPin, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { intlLocale, type Locale } from '@/i18n/config'
import type { CampaignListItem, PostListItem, ProjectListItem } from '@/lib/content/queries'
import { formatMoney, formatNumber } from '@/lib/money'
import { percentage, truncate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { MediaImage } from '@/components/ui/media-image'
import { Progress } from '@/components/ui/progress'

const statusVariant = {
  planned: 'outline',
  in_progress: 'warning',
  completed: 'success',
} as const

function formatDate(value: string | Date | null, locale: Locale): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export async function ProjectCard({
  project,
  locale,
}: {
  project: ProjectListItem
  locale: Locale
}) {
  const t = await getTranslations('projects')

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground transition-shadow hover:shadow-token">
      <Link href={`/projects/${project.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-muted">
        <MediaImage
          media={project.cover}
          locale={locale}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3">
          <Badge variant={statusVariant[project.status]} className="bg-background/95">
            {t(`status.${project.status}`)}
          </Badge>
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {project.district ? (
          <p className="flex items-center gap-1.5 text-small text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {[project.village, project.district].filter(Boolean).join(', ')}
          </p>
        ) : null}

        <h3 className="text-subheading font-semibold">
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0">
            {project.title}
          </Link>
        </h3>

        {project.summary ? (
          <p className="text-sm text-muted-foreground">{truncate(project.summary, 140)}</p>
        ) : null}

        <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-2 text-small">
          {project.beneficiaries > 0 ? (
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" aria-hidden />
              <dt className="sr-only">{t('facts.beneficiaries')}</dt>
              <dd className="font-medium">{formatNumber(project.beneficiaries, locale, true)}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <Droplets className="size-3.5 text-primary" aria-hidden />
            <dt className="sr-only">{t('facts.wells')}</dt>
            <dd className="font-medium">{project.wellsCount}</dd>
          </div>
          {project.completionDate || project.plannedCompletionDate ? (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-primary" aria-hidden />
              <dt className="sr-only">{t('facts.completed')}</dt>
              <dd className="font-medium">
                {formatDate(project.completionDate ?? project.plannedCompletionDate, locale)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  )
}

export async function PostCard({ post, locale }: { post: PostListItem; locale: Locale }) {
  const t = await getTranslations('blog')

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground transition-shadow hover:shadow-token">
      <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-muted">
        <MediaImage
          media={post.cover}
          locale={locale}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex flex-wrap items-center gap-2 text-small text-muted-foreground">
          {post.category ? <Badge variant="primary">{post.category.name}</Badge> : null}
          {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt, locale)}</time> : null}
          <span aria-hidden>·</span>
          <span>{t('readingTime', { minutes: post.readingMinutes })}</span>
        </div>

        <h3 className="text-subheading font-semibold">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="text-sm text-muted-foreground">{truncate(post.excerpt, 150)}</p>
        ) : null}
      </div>
    </article>
  )
}

export async function CampaignCard({
  campaign,
  locale,
}: {
  campaign: CampaignListItem
  locale: Locale
}) {
  const t = await getTranslations('campaigns')
  const raised = campaign.raisedAmount + campaign.offlineAmount
  const progress = percentage(raised, campaign.goalAmount)

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground transition-shadow hover:shadow-token">
      <Link
        href={`/campaigns/${campaign.slug}`}
        className="relative block aspect-[16/9] overflow-hidden bg-muted"
      >
        <MediaImage
          media={campaign.cover}
          locale={locale}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-subheading font-semibold">
          <Link href={`/campaigns/${campaign.slug}`} className="after:absolute after:inset-0">
            {campaign.title}
          </Link>
        </h3>

        {campaign.summary ? (
          <p className="text-sm text-muted-foreground">{truncate(campaign.summary, 150)}</p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Progress value={progress} label={t('raised')} />
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-small">
            <span className="font-semibold text-primary">
              {formatMoney(raised, campaign.currency, locale, { hideDecimals: true })}
            </span>
            <span className="text-muted-foreground">
              {t('goal')}: {formatMoney(campaign.goalAmount, campaign.currency, locale, { hideDecimals: true })}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

/** Text link with a trailing arrow, used at the end of listing sections. */
export function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-[gap] hover:gap-2.5"
    >
      {label}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  )
}
