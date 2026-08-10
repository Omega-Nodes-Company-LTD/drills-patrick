import Image from 'next/image'
import type { MediaRow } from '@/db/schema'
import { pickI18n, type Locale } from '@/i18n/config'
import { mediaUrl } from '@/lib/storage/urls'
import { cn } from '@/lib/utils'

/**
 * Renders a media row through `next/image`, with the stored LQIP as the blur
 * placeholder. When storage is unconfigured (or the asset is missing) it falls
 * back to a tinted panel so layouts never collapse.
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

  return (
    <Image
      src={url}
      alt={altText}
      className={cn('object-cover', className)}
      sizes={sizes}
      priority={priority}
      placeholder={media?.placeholder ? 'blur' : 'empty'}
      blurDataURL={media?.placeholder ?? undefined}
      {...(fill
        ? { fill: true }
        : { width: width ?? media?.width ?? 1200, height: height ?? media?.height ?? 800 })}
    />
  )
}
