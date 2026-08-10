import { Link } from '@/i18n/navigation'
import { pickI18n, type Locale } from '@/i18n/config'
import type {
  CtaBlock,
  GalleryBlock,
  RichTextBlock,
  StatsBlock,
  StepsBlock,
  VideoBlock,
} from '@/lib/blocks/schema'
import { getMediaById, getMediaByIds } from '@/lib/media/service'
import { sanitizeHtml, toEmbedUrl } from '@/lib/sanitize'
import { cn, isExternalHref } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MediaImage } from '@/components/ui/media-image'
import { Section, SectionHeading } from './section'

export function RichTextBlockView({ block, locale }: { block: RichTextBlock; locale: Locale }) {
  const html = sanitizeHtml(pickI18n(block.content, locale))
  const title = pickI18n(block.title, locale)

  if (!html && !title) return null

  return (
    <Section layout={block.layout}>
      {title ? <h2 className="mb-6 text-title">{title}</h2> : null}
      <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />
    </Section>
  )
}

export function StatsBlockView({ block, locale }: { block: StatsBlock; locale: Locale }) {
  if (block.items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        className="mb-8"
      />
      <dl
        className={cn(
          'grid gap-6 sm:gap-8',
          block.items.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {block.items.map((item, index) => (
          <div
            key={index}
            className="flex flex-col gap-1 border-t-2 border-accent pt-4"
          >
            <dd className="font-heading text-title font-bold">
              {item.value}
              {item.suffix ? <span className="text-heading opacity-70">{item.suffix}</span> : null}
            </dd>
            <dt className="text-small opacity-75">{pickI18n(item.label, locale)}</dt>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export function StepsBlockView({ block, locale }: { block: StepsBlock; locale: Locale }) {
  if (block.items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        className="mb-8"
      />
      <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {block.items.map((item, index) => (
          <li key={index} className="flex flex-col gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
              {index + 1}
            </span>
            <h3 className="text-subheading font-semibold">{pickI18n(item.title, locale)}</h3>
            <p className="text-sm opacity-80">{pickI18n(item.text, locale)}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export async function CtaBlockView({ block, locale }: { block: CtaBlock; locale: Locale }) {
  const media = await getMediaById(block.mediaId)
  const title = pickI18n(block.title, locale)
  if (!title) return null

  return (
    <Section layout={block.layout}>
      <div
        className={cn(
          'flex flex-col gap-6 rounded-[var(--radius-xl)] p-6 md:p-10',
          media ? 'relative isolate overflow-hidden text-white' : 'bg-black/5 dark:bg-white/5',
          'lg:flex-row lg:items-center lg:justify-between',
        )}
      >
        {media ? (
          <>
            <div className="absolute inset-0 -z-10">
              <MediaImage media={media} locale={locale} sizes="100vw" />
            </div>
            <div className="absolute inset-0 -z-10 bg-black/55" aria-hidden />
          </>
        ) : null}

        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{title}</h2>
          {pickI18n(block.text, locale) ? (
            <p className="max-w-2xl opacity-90">{pickI18n(block.text, locale)}</p>
          ) : null}
        </div>

        {block.ctas.length > 0 ? (
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            {block.ctas.map((cta, index) => {
              const label = pickI18n(cta.label, locale)
              if (!label) return null
              return (
                <Button key={index} asChild size="lg" variant={cta.variant}>
                  {isExternalHref(cta.href) ? (
                    <a href={cta.href} target="_blank" rel="noreferrer noopener">
                      {label}
                    </a>
                  ) : (
                    <Link href={cta.href}>{label}</Link>
                  )}
                </Button>
              )
            })}
          </div>
        ) : null}
      </div>
    </Section>
  )
}

const aspectClasses = {
  square: 'aspect-square',
  landscape: 'aspect-[4/3]',
  portrait: 'aspect-[3/4]',
}

export async function GalleryBlockView({
  block,
  locale,
}: {
  block: GalleryBlock
  locale: Locale
}) {
  if (block.mediaIds.length === 0) return null

  const map = await getMediaByIds(block.mediaIds)
  const items = block.mediaIds.map((id) => map.get(id)).filter(Boolean)
  if (items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading title={pickI18n(block.title, locale)} className="mb-6" />
      <div
        className={cn(
          'grid gap-3 sm:gap-4',
          block.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : '',
          block.columns === 3 ? 'grid-cols-2 md:grid-cols-3' : '',
          block.columns === 4 ? 'grid-cols-2 md:grid-cols-4' : '',
        )}
      >
        {items.map((item) => (
          <figure
            key={item!.id}
            className={cn(
              'relative overflow-hidden rounded-[var(--radius-lg)] bg-muted',
              aspectClasses[block.aspect],
            )}
          >
            <MediaImage
              media={item}
              locale={locale}
              sizes="(max-width: 768px) 50vw, 25vw"
              className="transition-transform duration-500 hover:scale-105"
            />
          </figure>
        ))}
      </div>
    </Section>
  )
}

export function VideoBlockView({ block, locale }: { block: VideoBlock; locale: Locale }) {
  const embed = toEmbedUrl(block.url)
  if (!embed) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading title={pickI18n(block.title, locale)} className="mb-6" />
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-lg)] bg-muted">
        <iframe
          src={embed}
          title={pickI18n(block.title, locale) || 'video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 size-full"
        />
      </div>
      {pickI18n(block.caption, locale) ? (
        <p className="mt-3 text-small opacity-75">{pickI18n(block.caption, locale)}</p>
      ) : null}
    </Section>
  )
}
