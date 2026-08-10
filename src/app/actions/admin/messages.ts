'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { contactSubmissions, newsletterSubscribers } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Contact messages and newsletter subscribers. Both are written by the public
 * site; until now nothing could read them back.
 */

const uuid = z.string().uuid()

export async function setContactHandled(id: string, isHandled: boolean): Promise<ActionResult> {
  const user = await requireApiUser('inquiries')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = uuid.safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db
    .update(contactSubmissions)
    .set({ isHandled })
    .where(eq(contactSubmissions.id, parsed.data))

  await recordAudit({
    actor: user,
    action: 'contact.update',
    entityType: 'contactSubmission',
    entityId: parsed.data,
    summary: isHandled ? 'handled' : 'reopened',
  })

  revalidatePath('/[locale]/admin/messages', 'page')
  return { ok: true }
}

export async function deleteContactSubmission(id: string): Promise<ActionResult> {
  const user = await requireApiUser('inquiries')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = uuid.safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(contactSubmissions).where(eq(contactSubmissions.id, parsed.data))

  await recordAudit({
    actor: user,
    action: 'contact.delete',
    entityType: 'contactSubmission',
    entityId: parsed.data,
  })

  revalidatePath('/[locale]/admin/messages', 'page')
  return { ok: true }
}

/**
 * Removes a subscriber outright rather than flagging them, so an erasure
 * request leaves nothing behind.
 */
export async function deleteSubscriber(id: string): Promise<ActionResult> {
  const user = await requireApiUser('inquiries')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = uuid.safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, parsed.data))

  await recordAudit({
    actor: user,
    action: 'subscriber.delete',
    entityType: 'newsletterSubscriber',
    entityId: parsed.data,
  })

  revalidatePath('/[locale]/admin/messages', 'page')
  return { ok: true }
}
