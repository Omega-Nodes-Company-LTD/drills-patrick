'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { media } from '@/db/schema'
import { i18nTextSchema } from '@/i18n/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { deleteMedia } from '@/lib/media/service'
import type { ActionResult } from '@/lib/validation/public'

const updateSchema = z.object({
  id: z.string().uuid(),
  alt: i18nTextSchema,
  caption: i18nTextSchema,
  credit: z.string().trim().max(200).optional(),
  folder: z.string().trim().max(60).default('general'),
})

export async function updateMedia(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('media')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db
    .update(media)
    .set({
      alt: parsed.data.alt,
      caption: parsed.data.caption,
      credit: parsed.data.credit || null,
      folder: parsed.data.folder || 'general',
    })
    .where(eq(media.id, parsed.data.id))

  await recordAudit({
    actor: user,
    action: 'media.update',
    entityType: 'media',
    entityId: parsed.data.id,
  })

  revalidatePath('/[locale]/admin/media', 'page')
  return { ok: true }
}

export async function removeMedia(id: string): Promise<ActionResult> {
  const user = await requireApiUser('media')
  if (!user) return { ok: false, error: 'unauthorised' }

  await deleteMedia(id)

  await recordAudit({ actor: user, action: 'media.delete', entityType: 'media', entityId: id })

  revalidatePath('/[locale]/admin/media', 'page')
  return { ok: true }
}
