'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import {
  impactIndicatorTranslations,
  impactIndicators,
  spendingEntries,
  spendingEntryTranslations,
  waterPointReadings,
} from '@/db/schema'
import { locales, type Locale } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { parseAmount, toMinorUnits } from '@/lib/money'
import type { ActionResult } from '@/lib/validation/public'

/** Readings, impact indicators and spending — the published numbers. */

const readingSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  yieldLitersPerHour: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  staticLevelM: z.coerce.number().int().min(0).max(5000).nullish(),
  note: z.string().trim().max(2000).optional(),
  measuredBy: z.string().trim().max(160).optional(),
})

export async function saveReading(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = readingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    projectId: data.projectId,
    measuredOn: data.measuredOn,
    yieldLitersPerHour: data.yieldLitersPerHour ?? null,
    staticLevelM: data.staticLevelM ?? null,
    note: data.note || null,
    measuredBy: data.measuredBy || null,
  }

  let id = data.id

  if (id) {
    await db.update(waterPointReadings).set(values).where(eq(waterPointReadings.id, id))
  } else {
    const [created] = await db
      .insert(waterPointReadings)
      .values(values)
      .returning({ id: waterPointReadings.id })
    id = created!.id
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'reading.update' : 'reading.create',
    entityType: 'waterPointReading',
    entityId: id,
    summary: data.measuredOn,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteReading(id: string): Promise<ActionResult> {
  const user = await requireApiUser('projects')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(waterPointReadings).where(eq(waterPointReadings.id, parsed.data))
  await recordAudit({
    actor: user,
    action: 'reading.delete',
    entityType: 'waterPointReading',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}

const localeRecord = <T extends z.ZodTypeAny>(inner: T) =>
  z.object(Object.fromEntries(locales.map((locale) => [locale, inner.optional()])))

const indicatorSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and dashes'),
  value: z.string().trim().min(1).max(60),
  unit: z.string().trim().max(30).optional(),
  // Required, not optional: an indicator without a stated method is a claim,
  // and this whole area exists to stop the site making those.
  methodology: z.string().trim().min(10).max(4000),
  source: z.string().trim().max(500).optional(),
  verifiedOn: z.string().max(10).optional(),
  sortOrder: z.coerce.number().int().default(0),
  translations: localeRecord(
    z.object({
      label: z.string().trim().max(200).optional(),
      methodology: z.string().trim().max(4000).optional(),
    }),
  ),
})

export async function saveIndicator(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('settings')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = indicatorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    key: data.key,
    value: data.value,
    unit: data.unit || null,
    methodology: data.methodology,
    source: data.source || null,
    verifiedOn: data.verifiedOn || null,
    sortOrder: data.sortOrder,
  }

  let id = data.id

  if (id) {
    await db.update(impactIndicators).set(values).where(eq(impactIndicators.id, id))
  } else {
    const [created] = await db
      .insert(impactIndicators)
      .values(values)
      .returning({ id: impactIndicators.id })
    id = created!.id
  }

  await db.delete(impactIndicatorTranslations).where(eq(impactIndicatorTranslations.indicatorId, id))

  for (const locale of locales) {
    const translation = data.translations[locale as Locale]
    if (!translation?.label?.trim() && !translation?.methodology?.trim()) continue

    await db.insert(impactIndicatorTranslations).values({
      indicatorId: id,
      locale,
      label: translation.label ?? '',
      methodology: translation.methodology || null,
    })
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'indicator.update' : 'indicator.create',
    entityType: 'impactIndicator',
    entityId: id,
    summary: `${data.key} = ${data.value}`,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteIndicator(id: string): Promise<ActionResult> {
  const user = await requireApiUser('settings')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(impactIndicators).where(eq(impactIndicators.id, parsed.data))
  await recordAudit({
    actor: user,
    action: 'indicator.delete',
    entityType: 'impactIndicator',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}

const spendingSchema = z.object({
  id: z.string().uuid().optional(),
  year: z.coerce.number().int().min(1900).max(2200),
  category: z.string().trim().min(1).max(120),
  amount: z.preprocess(parseAmount, z.number().min(0)),
  currency: z.string().trim().length(3).default('EUR'),
  note: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().default(0),
  translations: localeRecord(z.object({ label: z.string().trim().max(200).optional() })),
})

export async function saveSpendingEntry(input: unknown): Promise<ActionResult<{ id: string }>> {
  // Finance owns the numbers behind "how we spend it".
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = spendingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const currency = data.currency.toUpperCase()
  const values = {
    year: data.year,
    category: data.category,
    amountMinor: toMinorUnits(data.amount, currency),
    currency,
    note: data.note || null,
    sortOrder: data.sortOrder,
  }

  let id = data.id

  if (id) {
    await db.update(spendingEntries).set(values).where(eq(spendingEntries.id, id))
  } else {
    const [created] = await db
      .insert(spendingEntries)
      .values(values)
      .returning({ id: spendingEntries.id })
    id = created!.id
  }

  await db.delete(spendingEntryTranslations).where(eq(spendingEntryTranslations.entryId, id))

  for (const locale of locales) {
    const label = data.translations[locale as Locale]?.label?.trim()
    if (!label) continue
    await db.insert(spendingEntryTranslations).values({ entryId: id, locale, label })
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'spending.update' : 'spending.create',
    entityType: 'spendingEntry',
    entityId: id,
    summary: `${data.year} ${data.category}`,
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteSpendingEntry(id: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db.delete(spendingEntries).where(eq(spendingEntries.id, parsed.data))
  await recordAudit({
    actor: user,
    action: 'spending.delete',
    entityType: 'spendingEntry',
    entityId: parsed.data,
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}
