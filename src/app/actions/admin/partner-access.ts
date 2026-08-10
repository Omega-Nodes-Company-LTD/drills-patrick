'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { ngoContacts, partnerProjects } from '@/db/schema'
import { locales } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { hashPassword, passwordIssues } from '@/lib/auth/password'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Who at a partner organisation may sign in, and which projects they see.
 *
 * Creating an account here is the only way one exists: there is no public
 * registration, because access to another organisation's borehole records is
 * not something to grant on a form submission.
 */

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  partnerId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(160),
  role: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  locale: z.enum(locales).default('en'),
  reportFrequency: z.enum(['none', 'monthly', 'quarterly']).default('none'),
  isActive: z.boolean().default(true),
  /** Required when creating; optional when editing. */
  password: z.string().max(200).optional(),
})

export async function savePartnerContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('users')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data

  if (!data.id && !data.password) return { ok: false, error: 'password_required' }
  if (data.password) {
    const issues = passwordIssues(data.password)
    if (issues.length > 0) return { ok: false, error: 'weak_password' }
  }

  const values = {
    partnerId: data.partnerId,
    email: data.email,
    name: data.name,
    role: data.role || null,
    phone: data.phone || null,
    locale: data.locale,
    reportFrequency: data.reportFrequency,
    isActive: data.isActive,
    ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
  }

  let id = data.id

  if (id) {
    await db.update(ngoContacts).set(values).where(eq(ngoContacts.id, id))
  } else {
    const [created] = await db
      .insert(ngoContacts)
      .values(values as typeof ngoContacts.$inferInsert)
      .returning({ id: ngoContacts.id })
    id = created!.id
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'partnerContact.update' : 'partnerContact.create',
    entityType: 'ngoContact',
    entityId: id,
    summary: data.email,
  })

  revalidatePath('/[locale]/admin/partner-access', 'page')
  return { ok: true, data: { id } }
}

export async function deletePartnerContact(id: string): Promise<ActionResult> {
  const user = await requireApiUser('users')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(ngoContacts).where(eq(ngoContacts.id, parsed.data))
  await recordAudit({
    actor: user,
    action: 'partnerContact.delete',
    entityType: 'ngoContact',
    entityId: parsed.data,
  })

  revalidatePath('/[locale]/admin/partner-access', 'page')
  return { ok: true }
}

const linkSchema = z.object({
  partnerId: z.string().uuid(),
  projectIds: z.array(z.string().uuid()).default([]),
})

/** Replaces the set of projects a partner organisation can see. */
export async function setPartnerProjects(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('users')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = linkSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(partnerProjects).where(eq(partnerProjects.partnerId, parsed.data.partnerId))

  if (parsed.data.projectIds.length > 0) {
    await db
      .insert(partnerProjects)
      .values(
        parsed.data.projectIds.map((projectId) => ({
          partnerId: parsed.data.partnerId,
          projectId,
        })),
      )
  }

  await recordAudit({
    actor: user,
    action: 'partnerProjects.set',
    entityType: 'partner',
    entityId: parsed.data.partnerId,
    summary: `${parsed.data.projectIds.length} projects`,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}
