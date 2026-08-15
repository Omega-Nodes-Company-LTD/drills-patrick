import type { MediaRow } from '@/db/schema'
import { pickI18n, type Locale } from '@/i18n/config'
import { mediaSources, pickSource } from '@/lib/media/sources'
import { mediaUrl } from '@/lib/storage/urls'
import { cn } from '@/lib/utils'
import { MediaImageClient } from './media-image-client'

/**
 * Renders a media row through `next/image`, choosing between the derivatives
 * written at upload time, with the stored LQIP as the blur placeholder. When
 * storage is unconfigured (or the asset is missing) it falls back to a tinted
 * panel so layouts never collapse.
 */
export function MediaImage({
  media,
  locale,
  className,
  sizes = '100vw',
  fill = true,
  width,
  height,
  priority,
  alt,
}: {
  media?: MediaRow | null
  locale: Locale
  className?: string
  sizes?: string
  fill?: boolean
  width?: number
  height?: number
  priority?: boolean
  alt?: string
}) {
  const url = mediaUrl(media?.objectKey)

  if (!url) {
    return (
      <div
        className={cn(
          'bg-gradient-to-br from-primary/25 via-muted to-accent/20',
          fill ? 'absolute inset-0' : 'h-full w-full',
          className,
        )}
        aria-hidden
      />
    )
  }

  const altText = alt ?? pickI18n(media?.alt, locale) ?? ''
  const sources = mediaSources(media?.variants, mediaUrl)

  return (
    <MediaImageClient
      // A derivative rather than the original, because `images.unoptimized`
      // makes Next.js skip the loader below and emit this URL on its own. That
      // is the configuration a deployment falls back to when the bucket host is
      // missing from the build, and it is exactly when serving the untouched
      // upload hurts most. 1440 is the width that covers an ordinary screen
      // without carrying a photograph meant for a billboard.
      src={pickSource(sources, url, 1440)}
      sources={sources}
      alt={altText}
      className={className}
      sizes={sizes}
      priority={priority}
      placeholder={media?.placeholder ? 'blur' : 'empty'}
      blurDataURL={media?.placeholder ?? undefined}
      {...(fill
        ? { fill: true }
        : { fill: false, width: width ?? media?.width ?? 1200, height: height ?? media?.height ?? 800 })}
    />
  )
}
