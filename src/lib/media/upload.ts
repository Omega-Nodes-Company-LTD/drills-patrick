import 'server-only'
import sharp from 'sharp'
import { db } from '@/db'
import { media, type MediaRow } from '@/db/schema'
import { buildObjectKey } from '@/lib/storage/urls'
import { putObject } from '@/lib/storage/s3'
import { matchesDeclaredType, sanitizeSvg } from './sniff'

/**
 * Uploads go through the application rather than straight to S3 so we can read
 * the dimensions, build responsive derivatives and store a blur placeholder in
 * one round trip.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Decoded-pixel ceiling. A 30 KB PNG can declare 60 000 × 60 000 pixels and
 * cost several gigabytes to decompress — a decompression bomb the byte limit
 * above does nothing about. 80 megapixels is far beyond any photograph the
 * field teams upload.
 */
export const MAX_IMAGE_PIXELS = 80_000_000

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
])

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
])

/** Widths generated for raster images; larger than the source is skipped. */
const VARIANT_WIDTHS = [480, 960, 1440, 1920]

export function isAllowedType(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType) || DOCUMENT_TYPES.has(mimeType)
}

function kindOf(mimeType: string): MediaRow['kind'] {
  if (IMAGE_TYPES.has(mimeType)) return 'image'
  if (DOCUMENT_TYPES.has(mimeType)) return 'document'
  if (mimeType.startsWith('video/')) return 'video'
  return 'other'
}

export type UploadResult = { ok: true; media: MediaRow } | { ok: false; error: string }

export async function storeUpload(params: {
  file: File
  folder: string
  uploadedById: string | null
}): Promise<UploadResult> {
  const { file, folder } = params

  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'too_large' }
  if (!isAllowedType(file.type)) return { ok: false, error: 'unsupported' }

  let buffer = Buffer.from(await file.arrayBuffer())

  // The declared type comes from the client; the bytes decide.
  if (!matchesDeclaredType(buffer, file.type)) return { ok: false, error: 'type_mismatch' }

  // SVGs are served straight from the bucket, so anything executable in one
  // would run on the storage origin. Only shapes survive.
  if (file.type === 'image/svg+xml') {
    const clean = sanitizeSvg(buffer.toString('utf8'))
    if (!clean.includes('<svg')) return { ok: false, error: 'unsupported' }
    buffer = Buffer.from(clean, 'utf8')
  }

  const kind = kindOf(file.type)
  const key = buildObjectKey(folder, file.name)

  let width: number | null = null
  let height: number | null = null
  let placeholder: string | null = null
  const variants: Record<string, string> = {}

  // SVG and GIF are stored as-is: rasterising them would lose what they are for.
  const raster = kind === 'image' && file.type !== 'image/svg+xml' && file.type !== 'image/gif'

  if (raster) {
    // sharp throws rather than allocating when the header declares more.
    const limits = { failOn: 'none' as const, limitInputPixels: MAX_IMAGE_PIXELS }

    try {
      const metadata = await sharp(buffer, limits).metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null

      if (width && height && width * height > MAX_IMAGE_PIXELS) {
        return { ok: false, error: 'too_many_pixels' }
      }

      const tiny = await sharp(buffer, limits)
        .resize(16, 16, { fit: 'inside' })
        .webp({ quality: 40 })
        .toBuffer()
      placeholder = `data:image/webp;base64,${tiny.toString('base64')}`

      for (const target of VARIANT_WIDTHS) {
        if (width && target >= width) continue

        const resized = await sharp(buffer, limits)
          .resize(target, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer()

        const variantKey = key.replace(/(\.[^.]+)?$/, `-${target}.webp`)
        await putObject({ key: variantKey, body: resized, contentType: 'image/webp' })
        variants[String(target)] = variantKey
      }
    } catch (error) {
      // A corrupt image should not abort the upload; store the original.
      console.error('[media] processing failed, storing original only:', error)
    }
  }

  await putObject({ key, body: buffer, contentType: file.type })

  const [row] = await db
    .insert(media)
    .values({
      objectKey: key,
      bucket: process.env.S3_BUCKET ?? '',
      kind,
      mimeType: file.type,
      originalName: file.name,
      // The stored buffer, not the uploaded one: sanitising an SVG shrinks it.
      sizeBytes: buffer.byteLength,
      width,
      height,
      placeholder,
      variants,
      folder: folder || 'general',
      uploadedById: params.uploadedById,
    })
    .returning()

  return { ok: true, media: row! }
}
