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

export function publicBaseUrl(): string {
  if (env.S3_PUBLIC_BASE_URL) return env.S3_PUBLIC_BASE_URL.replace(/\/+$/, '')
  if (!env.S3_ENDPOINT || !env.S3_BUCKET) return ''

  const endpoint = env.S3_ENDPOINT.replace(/\/+$/, '')
  return env.S3_FORCE_PATH_STYLE ? `${endpoint}/${env.S3_BUCKET}` : endpoint
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
