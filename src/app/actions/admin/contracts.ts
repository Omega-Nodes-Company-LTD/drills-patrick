'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { contractProjects, maintenanceContracts } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { parseAmount, toMinorUnits } from '@/lib/money'
import type { ActionResult } from '@/lib/validation/public'

/** Maintenance contracts and the water points they cover. */

const contractSchema = z.object({
  id: z.string().uuid().optional(),
  partnerId: z.string().uuid(),
  reference: z.string().trim().min(1).max(80),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitIntervalMonths: z.coerce.number().int().min(1).max(60).default(6),
  fee: z.preprocess(parseAmount, z.number().min(0)).default(0),
  currency: z.string().trim().length(3).default('UGX'),
  responseHours: z.coerce.number().int().min(1).max(2160).default(72),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(4000).optional(),
  projectIds: z.array(z.string().uuid()).default([]),
})

export async function saveContract(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = contractSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  if (data.endsOn <= data.startsOn) return { ok: false, error: 'invalid_period' }

  const currency = data.currency.toUpperCase()
  const values = {
    partnerId: data.partnerId,
    reference: data.reference,
    startsOn: data.startsOn,
    endsOn: data.endsOn,
    visitIntervalMonths: data.visitIntervalMonths,
    feeMinor: toMinorUnits(data.fee, currency),
    currency,
    responseHours: data.responseHours,
    isActive: data.isActive,
    notes: data.notes || null,
  }

  let id = data.id

  if (id) {
    await db.update(maintenanceContracts).set(values).where(eq(maintenanceContracts.id, id))
  } else {
    const [created] = await db
      .insert(maintenanceContracts)
      .values(values)
      .returning({ id: maintenanceContracts.id })
    id = created!.id
  }

  await db.delete(contractProjects).where(eq(contractProjects.contractId, id))
  if (data.projectIds.length > 0) {
    await db
      .insert(contractProjects)
      .values(data.projectIds.map((projectId) => ({ contractId: id!, projectId })))
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'contract.update' : 'contract.create',
    entityType: 'maintenanceContract',
    entityId: id,
    summary: data.reference,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteContract(id: string): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(maintenanceContracts).where(eq(maintenanceContracts.id, parsed.data))
  await recordAudit({
    actor: user,
    action: 'contract.delete',
    entityType: 'maintenanceContract',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}
