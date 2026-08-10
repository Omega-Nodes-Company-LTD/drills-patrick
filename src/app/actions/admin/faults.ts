'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { faultReports, maintenanceVisits } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Moving a fault along, and recording the visit that fixed it.
 *
 * The timestamps are set here rather than derived from a status history,
 * because they are what the service figures are computed from and a derived
 * one would be wrong the first time a status was corrected.
 */

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['reported', 'acknowledged', 'in_progress', 'resolved', 'closed']),
  resolutionNote: z.string().trim().max(2000).optional(),
})

export async function updateFault(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const [existing] = await db
    .select()
    .from(faultReports)
    .where(eq(faultReports.id, parsed.data.id))
    .limit(1)

  if (!existing) return { ok: false, error: 'not_found' }

  const now = new Date()
  const isResolved = parsed.data.status === 'resolved' || parsed.data.status === 'closed'

  await db
    .update(faultReports)
    .set({
      status: parsed.data.status,
      resolutionNote: parsed.data.resolutionNote || existing.resolutionNote,
      // First acknowledgement only: re-opening and re-acknowledging must not
      // rewrite the response time that was actually achieved.
      acknowledgedAt:
        existing.acknowledgedAt ?? (parsed.data.status === 'reported' ? null : now),
      resolvedAt: isResolved ? (existing.resolvedAt ?? now) : null,
    })
    .where(eq(faultReports.id, parsed.data.id))

  await recordAudit({
    actor: user,
    action: 'fault.update',
    entityType: 'faultReport',
    entityId: parsed.data.id,
    summary: parsed.data.status,
  })

  revalidatePath('/[locale]/admin/faults', 'page')
  return { ok: true }
}

const visitSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  contractId: z.string().uuid().nullish(),
  faultReportId: z.string().uuid().nullish(),
  kind: z.enum(['scheduled', 'repair', 'inspection', 'training']),
  visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  technician: z.string().trim().max(160).optional(),
  findings: z.string().trim().max(4000).optional(),
  workDone: z.string().trim().max(4000).optional(),
  partsUsed: z.string().trim().max(2000).optional(),
  functionalAfter: z.boolean().default(true),
})

export async function saveMaintenanceVisit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = visitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    projectId: data.projectId,
    contractId: data.contractId || null,
    faultReportId: data.faultReportId || null,
    kind: data.kind,
    visitedOn: data.visitedOn,
    technician: data.technician || null,
    findings: data.findings || null,
    workDone: data.workDone || null,
    partsUsed: data.partsUsed || null,
    functionalAfter: data.functionalAfter,
  }

  let id = data.id

  if (id) {
    await db.update(maintenanceVisits).set(values).where(eq(maintenanceVisits.id, id))
  } else {
    const [created] = await db
      .insert(maintenanceVisits)
      .values(values)
      .returning({ id: maintenanceVisits.id })
    id = created!.id
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'visit.update' : 'visit.create',
    entityType: 'maintenanceVisit',
    entityId: id,
    summary: `${data.kind} ${data.visitedOn}`,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteMaintenanceVisit(id: string): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(maintenanceVisits).where(eq(maintenanceVisits.id, parsed.data))

  await recordAudit({
    actor: user,
    action: 'visit.delete',
    entityType: 'maintenanceVisit',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}
