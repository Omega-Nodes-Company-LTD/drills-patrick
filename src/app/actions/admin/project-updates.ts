'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { projectUpdateTranslations, projectUpdates } from '@/db/schema'
import { locales } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { sanitizeHtml } from '@/lib/sanitize'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Timeline entries on a project — "drilling started", "handover", and so on.
 * The public project page already renders them; this is the editor that fills
 * them in.
 */

const updateSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  mediaId: z.string().uuid().nullish(),
  happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date'),
  sortOrder: z.coerce.number().int().default(0),
  isPublished: z.boolean().default(true),
  translations: z.object(
    Object.fromEntries(
      locales.map((locale) => [
        locale,
        z
          .object({
            title: z.string().trim().max(300).optional(),
            body: z.string().max(50_000).optional(),
          })
          .optional(),
      ]),
    ),
  ),
})

export async function saveProjectUpdate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    projectId: data.projectId,
    mediaId: data.mediaId || null,
    happenedOn: data.happenedOn,
    sortOrder: data.sortOrder,
    isPublished: data.isPublished,
  }

  let id = data.id

  if (id) {
    await db.update(projectUpdates).set(values).where(eq(projectUpdates.id, id))
  } else {
    const [created] = await db.insert(projectUpdates).values(values).returning({
      id: projectUpdates.id,
    })
    id = created!.id
  }

  await db.delete(projectUpdateTranslations).where(eq(projectUpdateTranslations.updateId, id))

  for (const locale of locales) {
    const entry = data.translations[locale]
    const title = entry?.title?.trim() ?? ''
    // The body is rich text from the same editor as everywhere else.
    const body = sanitizeHtml(entry?.body ?? '')

    if (!title && !body.trim()) continue

    await db.insert(projectUpdateTranslations).values({ updateId: id, locale, title, body })
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'projectUpdate.update' : 'projectUpdate.create',
    entityType: 'projectUpdate',
    entityId: id,
    summary: data.happenedOn,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteProjectUpdate(id: string): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(projectUpdates).where(eq(projectUpdates.id, parsed.data))

  await recordAudit({
    actor: user,
    action: 'projectUpdate.delete',
    entityType: 'projectUpdate',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}
