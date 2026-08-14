/**
 * Choosing which stored file to serve for a requested width.
 *
 * Every raster upload is resized into a handful of WebP derivatives and their
 * keys are kept on the media row. Nothing ever read them: the site linked to
 * `objectKey` — the untouched original — and left the resizing to the Next.js
 * optimiser, which is switched off whenever the bucket host is missing from
 * the build. When that happened, and it happened on every image built without
 * the S3 build arguments, a four-megabyte photograph was downloaded to fill a
 * card three hundred pixels wide.
 *
 * Pointing at the derivatives instead makes the delivered size right either
 * way, and spends the work that was already being done at upload time.
 *
 * Kept free of `server-only` and of any database import: the picking runs in
 * the browser, inside the image loader, and the rules are worth pinning by
 * test on their own.
 */

export type MediaSource = { width: number; url: string }

/**
 * Ordered smallest-first, which is what `pickSource` expects.
 *
 * `variants` maps a width to an object key; anything unparseable is dropped
 * rather than trusted, since it comes from a JSON column.
 */
export function mediaSources(
  variants: Record<string, string> | null | undefined,
  toUrl: (objectKey: string) => string,
): MediaSource[] {
  if (!variants) return []

  return Object.entries(variants)
    .map(([width, key]) => ({ width: Number(width), url: toUrl(key) }))
    .filter((source) => Number.isFinite(source.width) && source.width > 0 && Boolean(source.url))
    .sort((a, b) => a.width - b.width)
}

/**
 * The file to serve at a requested width.
 *
 * The smallest derivative that still covers the request wins. When the request
 * is larger than every derivative the largest one is used rather than the
 * original: derivatives stop at the source's own width, so the original is
 * sharper — but it is also unprocessed, and a screen asking for 3840 pixels is
 * a screen that will not notice 2560 while it will certainly notice a
 * multi-megabyte download.
 *
 * With no derivatives at all — an SVG, a GIF, an image smaller than the
 * smallest step, or an upload whose processing failed — the original is the
 * only thing there is.
 */
export function pickSource(sources: MediaSource[], original: string, width: number): string {
  if (sources.length === 0) return original

  const covering = sources.find((source) => source.width >= width)
  return (covering ?? sources[sources.length - 1]!).url
}
