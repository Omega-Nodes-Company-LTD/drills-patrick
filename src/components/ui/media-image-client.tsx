'use client'

import Image from 'next/image'
import { useCallback } from 'react'
import { pickSource, type MediaSource } from '@/lib/media/sources'
import { cn } from '@/lib/utils'

/**
 * The `next/image` half of `MediaImage`.
 *
 * It exists only because a loader is a function, and a function cannot cross
 * from a server component into a client one. The server side works out the
 * URLs; this side picks between them for whichever widths the browser asks
 * about.
 *
 * The loader replaces `/_next/image`, so the derivatives are served straight
 * from the bucket. That loses AVIF, and gains an image that is the right size
 * whether or not the optimiser was configured at build time — the trade the
 * derivatives were generated for in the first place.
 */
export function MediaImageClient({
  src,
  sources,
  alt,
  className,
  sizes,
  fill,
  width,
  height,
  priority,
  placeholder,
  blurDataURL,
}: {
  src: string
  sources: MediaSource[]
  alt: string
  className?: string
  sizes?: string
  fill?: boolean
  width?: number
  height?: number
  priority?: boolean
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}) {
  const loader = useCallback(
    ({ width: requested }: { width: number }) => pickSource(sources, src, requested),
    [sources, src],
  )

  return (
    <Image
      // With no derivatives there is nothing to choose between, so the built-in
      // optimiser keeps its usual path.
      loader={sources.length > 0 ? loader : undefined}
      src={src}
      alt={alt}
      className={cn('object-cover', className)}
      sizes={sizes}
      priority={priority}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      {...(fill ? { fill: true } : { width: width ?? 1200, height: height ?? 800 })}
    />
  )
}
