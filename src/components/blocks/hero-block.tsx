import { Link } from '@/i18n/navigation'
import { pickI18n, type Locale } from '@/i18n/config'
import type { HeroBlock } from '@/lib/blocks/schema'
import { getMediaById } from '@/lib/media/service'
import { cn, isExternalHref } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from './section'

const heights = {
  sm: 'min-h-[16rem] md:min-h-[20rem]',
  md: 'min-h-[22rem] md:min-h-[28rem]',
  lg: 'min-h-[28rem] md:min-h-[34rem]',
  // Matches the site header, which is `h-16` and `md:h-18`.
  screen: 'min-h-[calc(100dvh-4rem)] md:min-h-[calc(100dvh-4.5rem)]',
}

export async function HeroBlockView({ block, locale }: { block: HeroBlock; locale: Locale }) {
  const media = await getMediaById(block.mediaId)
  const title = pickI18n(block.title, locale)
  const subtitle = pickI18n(block.subtitle, locale)
  const eyebrow = pickI18n(block.eyebrow, locale)

  return (
    <Section layout={block.layout} className="relative isolate overflow-hidden" innerClassName="relative">
      <div className="absolute inset-0 -z-10">
        <MediaImage media={media} locale={locale} priority sizes="100vw" />
        {media ? (
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: block.overlayOpacity }}
            aria-hidden
          />
        ) : null}
      </div>

      <div
        className={cn(
          'container-page flex flex-col justify-center gap-5 py-12 md:py-16',
          heights[block.height],
          block.align === 'center' ? 'items-center text-center' : 'items-start',
          media ? 'text-white' : undefined,
        )}
      >
        {eyebrow ? (
          <p className="text-small font-semibold uppercase tracking-wide opacity-85">{eyebrow}</p>
        ) : null}

        {title ? <h1 className="max-w-3xl text-display">{title}</h1> : null}

        {subtitle ? (
          <p className="max-w-2xl text-base opacity-90 md:text-lg">{subtitle}</p>
        ) : null}

        {block.ctas.length > 0 ? (
          <div
            className={cn(
              'mt-1 flex w-full flex-col gap-3 sm:w-auto sm:flex-row',
              block.align === 'center' && 'justify-center',
            )}
          >
            {block.ctas.map((cta, index) => {
              const label = pickI18n(cta.label, locale)
              if (!label) return null

              return (
                <Button
                  key={`${cta.href}-${index}`}
                  asChild
                  size="lg"
                  variant={cta.variant}
                  className={cn(
                    'w-full sm:w-auto',
                    media && cta.variant === 'outline' && 'border-white/70 text-white hover:bg-white/15',
                  )}
                >
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

        {block.highlights.length > 0 ? (
          <dl
            className={cn(
              'mt-4 grid w-full grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-8',
              block.align === 'center' && 'justify-center',
            )}
          >
            {block.highlights.map((highlight, index) => (
              <div key={index} className="flex flex-col">
                <dt className="order-2 text-small opacity-80">
                  {pickI18n(highlight.label, locale)}
                </dt>
                <dd className="order-1 font-heading text-heading font-bold">{highlight.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Section>
  )
}
