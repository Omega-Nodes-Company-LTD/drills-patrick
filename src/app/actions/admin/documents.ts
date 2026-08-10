'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { projectDocuments } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Project documents: water-quality certificates, drilling logs, handover
 * notes. The file is an ordinary media asset; this is the record of what it
 * is and who may see it.
 */

const documentSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  mediaId: z.string().uuid().nullish(),
  kind: z.enum([
    'water_quality',
    'drilling_log',
    'handover',
    'commissioning',
    'contract',
    'report',
    'other',
  ]),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  issuedOn: z.string().max(10).nullish(),
  expiresOn: z.string().max(10).nullish(),
  // Defaults to false in the schema too: a certificate naming a village and a
  // date is not something to publish by accident.
  isPublic: z.boolean().default(false),
})

export async function saveProjectDocument(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = documentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    projectId: data.projectId,
    mediaId: data.mediaId || null,
    kind: data.kind,
    title: data.title,
    description: data.description || null,
    issuedOn: data.issuedOn || null,
    expiresOn: data.expiresOn || null,
    isPublic: data.isPublic,
    uploadedById: user.id,
  }

  let id = data.id

  if (id) {
    await db.update(projectDocuments).set(values).where(eq(projectDocuments.id, id))
  } else {
    const [created] = await db
      .insert(projectDocuments)
      .values(values)
      .returning({ id: projectDocuments.id })
    id = created!.id
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'document.update' : 'document.create',
    entityType: 'projectDocument',
    entityId: id,
    summary: `${data.kind}: ${data.title}`,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteProjectDocument(id: string): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(projectDocuments).where(eq(projectDocuments.id, parsed.data))

  await recordAudit({
    actor: user,
    action: 'document.delete',
    entityType: 'projectDocument',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}
