import { NextResponse } from 'next/server'
import { features } from '@/env'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { MAX_UPLOAD_BYTES, storeUpload } from '@/lib/media/upload'
import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Multipart upload endpoint used by the media library. Files are processed and
 * pushed to the shared Hetzner bucket under `S3_PREFIX`.
 */
export async function POST(request: Request) {
  const user = await requireApiUser('media')
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })

  if (!features.storage) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const file = form.get('file')
  const folder = String(form.get('folder') ?? 'general')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'too_large', max: MAX_UPLOAD_BYTES }, { status: 413 })
  }

  try {
    const result = await storeUpload({ file, folder, uploadedById: user.id })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    await recordAudit({
      actor: user,
      action: 'media.upload',
      entityType: 'media',
      entityId: result.media.id,
      summary: result.media.originalName,
    })

    return NextResponse.json({
      media: { ...result.media, url: mediaUrl(result.media.objectKey) },
    })
  } catch (error) {
    console.error('[media/upload] failed:', error)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }
}
