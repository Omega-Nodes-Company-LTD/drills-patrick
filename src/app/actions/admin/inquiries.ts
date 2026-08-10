'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { ngoInquiries } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import type { ActionResult } from '@/lib/validation/public'

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'in_review', 'quoted', 'won', 'lost', 'archived']),
  adminNote: z.string().trim().max(2000).optional(),
})

/** Moves an inquiry along the pipeline and records who did it. */
export async function updateInquiry(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('inquiries')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db
    .update(ngoInquiries)
    .set({
      status: parsed.data.status,
      adminNote: parsed.data.adminNote ?? null,
      assignedToId: user.id,
    })
    .where(eq(ngoInquiries.id, parsed.data.id))

  await recordAudit({
    actor: user,
    action: 'inquiry.update',
    entityType: 'inquiry',
    entityId: parsed.data.id,
    summary: parsed.data.status,
  })

  revalidatePath('/[locale]/admin/inquiries', 'page')
  return { ok: true }
}
