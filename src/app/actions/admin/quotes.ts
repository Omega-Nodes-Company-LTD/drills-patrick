'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { drillingRates, quotes } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { parseAmount, toMinorUnits } from '@/lib/money'
import { buildQuote, quoteReference } from '@/lib/ngo/quotes'
import type { ActionResult } from '@/lib/validation/public'

/** The rate table and the quotes produced from it. */

const rateSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(160),
  depthFromM: z.coerce.number().int().min(0).max(2000).default(0),
  depthToM: z.coerce.number().int().min(1).max(2000).default(1000),
  geology: z.string().trim().max(60).default('any'),
  ratePerMetre: z.preprocess(parseAmount, z.number().min(0)).default(0),
  fixedCost: z.preprocess(parseAmount, z.number().min(0)).default(0),
  currency: z.string().trim().length(3).default('UGX'),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
})

export async function saveDrillingRate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = rateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  if (data.depthToM <= data.depthFromM) return { ok: false, error: 'invalid_band' }

  const currency = data.currency.toUpperCase()
  const values = {
    label: data.label,
    depthFromM: data.depthFromM,
    depthToM: data.depthToM,
    geology: data.geology || 'any',
    ratePerMetreMinor: toMinorUnits(data.ratePerMetre, currency),
    fixedCostMinor: toMinorUnits(data.fixedCost, currency),
    currency,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  }

  let id = data.id

  if (id) {
    await db.update(drillingRates).set(values).where(eq(drillingRates.id, id))
  } else {
    const [created] = await db
      .insert(drillingRates)
      .values(values)
      .returning({ id: drillingRates.id })
    id = created!.id
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'rate.update' : 'rate.create',
    entityType: 'drillingRate',
    entityId: id,
    summary: data.label,
  })

  revalidatePath('/[locale]/admin/quotes', 'page')
  return { ok: true, data: { id } }
}

export async function deleteDrillingRate(id: string): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(drillingRates).where(eq(drillingRates.id, parsed.data))
  await recordAudit({
    actor: user,
    action: 'rate.delete',
    entityType: 'drillingRate',
    entityId: parsed.data,
  })

  revalidatePath('/[locale]/admin/quotes', 'page')
  return { ok: true }
}

const quoteSchema = z.object({
  organisationName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().max(254).optional(),
  district: z.string().trim().max(120).optional(),
  geology: z.string().trim().max(60).default('any'),
  depthM: z.coerce.number().int().min(1).max(500),
  wellsCount: z.coerce.number().int().min(1).max(500),
  validUntil: z.string().max(10).optional(),
  notes: z.string().trim().max(4000).optional(),
})

/**
 * Issues a quote from the current rate table.
 *
 * The computed lines are stored on the row rather than recomputed on read: a
 * quote the office sent in March must still say in June what it said in
 * March, whatever happened to fuel prices in between.
 */
export async function createQuote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const rates = await db.select().from(drillingRates).orderBy(desc(drillingRates.sortOrder))
  const computed = buildQuote(rates, data)

  if (computed.incomplete) return { ok: false, error: 'no_rate' }

  const [created] = await db
    .insert(quotes)
    .values({
      reference: quoteReference(),
      organisationName: data.organisationName,
      contactName: data.contactName || null,
      contactEmail: data.contactEmail || null,
      district: data.district || null,
      geology: data.geology,
      depthM: data.depthM,
      wellsCount: data.wellsCount,
      lines: computed.lines,
      subtotalMinor: computed.subtotalMinor,
      totalMinor: computed.totalMinor,
      currency: computed.currency,
      validUntil: data.validUntil || null,
      notes: data.notes || null,
      createdById: user.id,
    })
    .returning({ id: quotes.id })

  await recordAudit({
    actor: user,
    action: 'quote.create',
    entityType: 'quote',
    entityId: created!.id,
    summary: data.organisationName,
  })

  revalidatePath('/[locale]/admin/quotes', 'page')
  return { ok: true, data: { id: created!.id } }
}
