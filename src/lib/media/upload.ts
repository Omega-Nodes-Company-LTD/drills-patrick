import 'server-only'
import sharp from 'sharp'
import { db } from '@/db'
import { media, type MediaRow } from '@/db/schema'
import { buildObjectKey } from '@/lib/storage/urls'
import { putObject } from '@/lib/storage/s3'

/**
 * Uploads go through the application rather than straight to S3 so we can read
 * the dimensions, build responsive derivatives and store a blur placeholder in
 * one round trip.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

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

  const buffer = Buffer.from(await file.arrayBuffer())
  const kind = kindOf(file.type)
  const key = buildObjectKey(folder, file.name)

  let width: number | null = null
  let height: number | null = null
  let placeholder: string | null = null
  const variants: Record<string, string> = {}

  // SVG and GIF are stored as-is: rasterising them would lose what they are for.
  const raster = kind === 'image' && file.type !== 'image/svg+xml' && file.type !== 'image/gif'

  if (raster) {
    try {
      const image = sharp(buffer, { failOn: 'none' })
      const metadata = await image.metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null

      const tiny = await sharp(buffer)
        .resize(16, 16, { fit: 'inside' })
        .webp({ quality: 40 })
        .toBuffer()
      placeholder = `data:image/webp;base64,${tiny.toString('base64')}`

      for (const target of VARIANT_WIDTHS) {
        if (width && target >= width) continue

        const resized = await sharp(buffer)
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
      sizeBytes: file.size,
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
