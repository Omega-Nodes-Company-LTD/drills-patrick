import { env } from '@/env'

/**
 * Object keys are stored with the `S3_PREFIX` already applied, so the shared
 * Hetzner bucket can host several sites without collisions.
 */
export function withPrefix(key: string): string {
  const clean = key.replace(/^\/+/, '')
  if (!env.S3_PREFIX) return clean
  return clean.startsWith(`${env.S3_PREFIX}/`) ? clean : `${env.S3_PREFIX}/${clean}`
}

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

/**
 * Where a stored object is publicly readable, worked out from configuration.
 *
 * Pure, so the addressing rules can be pinned by tests without an environment,
 * and so the read path and the write path can be shown to agree.
 */
export function resolvePublicBaseUrl(config: {
  publicBaseUrl?: string
  endpoint?: string
  bucket?: string
  forcePathStyle?: boolean
}): string {
  if (config.publicBaseUrl) return stripTrailingSlash(config.publicBaseUrl)
  if (!config.endpoint || !config.bucket) return ''

  const endpoint = stripTrailingSlash(config.endpoint)
  if (config.forcePathStyle) return `${endpoint}/${config.bucket}`

  // Virtual-hosted style addresses the bucket as a subdomain, so build that
  // here rather than assuming `S3_ENDPOINT` already carries it. When it does
  // not, the bucket drops out of the URL entirely and the first path segment —
  // the prefix — gets read as the bucket instead. That surfaces as NoSuchBucket
  // from the storage provider, a long way from the setting that caused it, and
  // only on reads: uploads keep working, because the SDK does this same
  // subdomain arithmetic itself.
  try {
    const url = new URL(endpoint)
    const alreadyScoped =
      url.hostname === config.bucket || url.hostname.startsWith(`${config.bucket}.`)
    if (!alreadyScoped) url.hostname = `${config.bucket}.${url.hostname}`
    return stripTrailingSlash(url.toString())
  } catch {
    // Not a parseable URL. Nothing can be inferred safely, so pass it through
    // rather than assembling something that looks right and is not.
    return endpoint
  }
}

export function publicBaseUrl(): string {
  return resolvePublicBaseUrl({
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  })
}

/** Absolute URL of a stored object. Returns an empty string when unconfigured. */
export function mediaUrl(objectKey: string | null | undefined): string {
  if (!objectKey) return ''
  const base = publicBaseUrl()
  if (!base) return ''
  return `${base}/${objectKey.replace(/^\/+/, '')}`
}

/** Builds a per-entity object key, e.g. `prefix/projects/2026/uuid-name.webp`. */
export function buildObjectKey(folder: string, fileName: string): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const year = new Date().getFullYear()
  const unique = crypto.randomUUID().slice(0, 8)
  const safeFolder = folder.replace(/[^a-z0-9\-_/]+/gi, '-') || 'general'

  return withPrefix(`${safeFolder}/${year}/${unique}-${safeName}`)
}
