'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import {
  campaignMilestoneTranslations,
  campaignMilestones,
  corporateSponsors,
  fundraisers,
  legacyEnquiries,
  matchingPledges,
  recurringPlans,
  wellAdoptions,
} from '@/db/schema'
import { locales } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { parseAmount, toMinorUnits } from '@/lib/money'
import type { ActionResult } from '@/lib/validation/public'

/** Admin side of the fundraising features: moderation and configuration. */

const localeMap = <T extends z.ZodTypeAny>(schema: T) =>
  z.object(Object.fromEntries(locales.map((locale) => [locale, schema.optional()])))

// ---------------------------------------------------- fundraiser moderation

const moderationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected', 'closed']),
  /** Shown to the owner rather than kept private, so a rejection needs one. */
  moderationNote: z.string().trim().max(1000).optional(),
})

export async function moderateFundraiser(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = moderationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data

  // Turning someone away without saying why is how a volunteer becomes a
  // complaint, so a rejection has to carry a reason.
  if (data.status === 'rejected' && !data.moderationNote?.trim()) {
    return { ok: false, error: 'reason_required' }
  }

  await db
    .update(fundraisers)
    .set({
      status: data.status,
      moderationNote: data.moderationNote || null,
      updatedAt: new Date(),
    })
    .where(eq(fundraisers.id, data.id))

  await recordAudit({
    actor: user,
    action: `fundraiser.${data.status}`,
    entityType: 'fundraiser',
    entityId: data.id,
  })

  revalidatePath('/admin/fundraisers')
  revalidatePath('/fundraisers')
  return { ok: true }
}

// --------------------------------------------------------------- milestones

const milestoneSchema = z.object({
  id: z.string().uuid().optional(),
  campaignId: z.string().uuid(),
  currency: z.string().trim().length(3),
  threshold: z.preprocess(parseAmount, z.number().positive()),
  sortOrder: z.coerce.number().int().default(0),
  translations: localeMap(
    z.object({
      label: z.string().trim().max(160).default(''),
      description: z.string().trim().max(600).default(''),
    }),
  ),
})

export async function saveMilestone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = milestoneSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    campaignId: data.campaignId,
    thresholdMinor: toMinorUnits(data.threshold, data.currency),
    sortOrder: data.sortOrder,
  }

  let id = data.id

  if (id) {
    await db.update(campaignMilestones).set(values).where(eq(campaignMilestones.id, id))
  } else {
    const [created] = await db
      .insert(campaignMilestones)
      .values(values)
      .returning({ id: campaignMilestones.id })
    id = created!.id
  }

  for (const locale of locales) {
    const translation = data.translations[locale]
    if (!translation) continue

    await db
      .insert(campaignMilestoneTranslations)
      .values({ milestoneId: id, locale, ...translation })
      .onConflictDoUpdate({
        target: [campaignMilestoneTranslations.milestoneId, campaignMilestoneTranslations.locale],
        set: translation,
      })
  }

  revalidatePath('/admin/campaigns')
  return { ok: true, data: { id } }
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  await db.delete(campaignMilestones).where(eq(campaignMilestones.id, id))
  revalidatePath('/admin/campaigns')
  return { ok: true }
}

// ----------------------------------------------------------- matching gift

/**
 * A pledge is a written agreement with a third party, so every term is
 * entered rather than defaulted. `matchedMinor` is never editable here: it is
 * evidence of what has already been committed, not a setting.
 */
const pledgeSchema = z.object({
  id: z.string().uuid().optional(),
  campaignId: z.string().uuid().nullish(),
  matcherName: z.string().trim().min(2).max(160),
  matcherLogoId: z.string().uuid().nullish(),
  matcherUrl: z.string().trim().max(500).optional(),
  ratioBp: z.coerce.number().int().min(1).max(1_000_000),
  ceiling: z.preprocess(parseAmount, z.number().positive()),
  perDonationCap: z.preprocess(parseAmount, z.number().positive()).nullish(),
  currency: z.string().trim().length(3),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  isActive: z.coerce.boolean().default(true),
  note: z.string().trim().max(1000).optional(),
})

export async function savePledge(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = pledgeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const startsAt = new Date(data.startsAt)
  const endsAt = new Date(data.endsAt)

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { ok: false, error: 'invalid' }
  }
  // A window that ends before it starts would silently match nothing, which
  // looks like a broken feature rather than a mistyped date.
  if (endsAt <= startsAt) return { ok: false, error: 'bad_window' }

  const values = {
    campaignId: data.campaignId || null,
    matcherName: data.matcherName,
    matcherLogoId: data.matcherLogoId || null,
    matcherUrl: data.matcherUrl || null,
    ratioBp: data.ratioBp,
    ceilingMinor: toMinorUnits(data.ceiling, data.currency),
    perDonationCapMinor:
      data.perDonationCap != null ? toMinorUnits(data.perDonationCap, data.currency) : null,
    currency: data.currency.toUpperCase(),
    startsAt,
    endsAt,
    isActive: data.isActive,
    note: data.note || null,
  }

  let id = data.id

  if (id) {
    await db
      .update(matchingPledges)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(matchingPledges.id, id))
  } else {
    const [created] = await db
      .insert(matchingPledges)
      .values(values)
      .returning({ id: matchingPledges.id })
    id = created!.id
  }

  await recordAudit({
    actor: user,
    action: data.id ? 'pledge.update' : 'pledge.create',
    entityType: 'matching_pledge',
    entityId: id,
  })

  revalidatePath('/admin/giving')
  revalidatePath('/donate')
  return { ok: true, data: { id } }
}

export async function deletePledge(id: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  await db.delete(matchingPledges).where(eq(matchingPledges.id, id))
  await recordAudit({
    actor: user,
    action: 'pledge.delete',
    entityType: 'matching_pledge',
    entityId: id,
  })

  revalidatePath('/admin/giving')
  return { ok: true }
}

// ------------------------------------------------------ corporate sponsors

const sponsorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  logoId: z.string().uuid().nullish(),
  websiteUrl: z.string().trim().max(500).optional(),
  projectId: z.string().uuid().nullish(),
  campaignId: z.string().uuid().nullish(),
  donationId: z.string().uuid().nullish(),
  tier: z.string().trim().max(80).optional(),
  contactName: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().max(254).optional(),
  legalName: z.string().trim().max(200).optional(),
  vatNumber: z.string().trim().max(60).optional(),
  addressLines: z.array(z.string().trim().max(200)).max(6).default([]),
  country: z.string().trim().max(80).optional(),
  isPublished: z.coerce.boolean().default(false),
  startsOn: z.string().trim().max(10).nullish(),
  endsOn: z.string().trim().max(10).nullish(),
  sortOrder: z.coerce.number().int().default(0),
})

export async function saveSponsor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = sponsorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    name: data.name,
    logoId: data.logoId || null,
    websiteUrl: data.websiteUrl || null,
    projectId: data.projectId || null,
    campaignId: data.campaignId || null,
    donationId: data.donationId || null,
    tier: data.tier || null,
    contactName: data.contactName || null,
    contactEmail: data.contactEmail || null,
    legalName: data.legalName || null,
    vatNumber: data.vatNumber || null,
    addressLines: data.addressLines.filter(Boolean),
    country: data.country || null,
    isPublished: data.isPublished,
    startsOn: data.startsOn || null,
    endsOn: data.endsOn || null,
    sortOrder: data.sortOrder,
  }

  let id = data.id

  if (id) {
    await db
      .update(corporateSponsors)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(corporateSponsors.id, id))
  } else {
    const [created] = await db
      .insert(corporateSponsors)
      .values(values)
      .returning({ id: corporateSponsors.id })
    id = created!.id
  }

  revalidatePath('/admin/giving')
  if (values.projectId) revalidatePath('/projects')
  return { ok: true, data: { id } }
}

export async function deleteSponsor(id: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  await db.delete(corporateSponsors).where(eq(corporateSponsors.id, id))
  revalidatePath('/admin/giving')
  return { ok: true }
}

// ------------------------------------------------------------- adoptions

const adoptionSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  donationId: z.string().uuid().nullish(),
  donorName: z.string().trim().min(2).max(160),
  donorEmail: z.string().trim().min(5).max(254),
  donorOrganisation: z.string().trim().max(160).optional(),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  amount: z.preprocess(parseAmount, z.number().min(0)).default(0),
  currency: z.string().trim().length(3),
  updateEveryMonths: z.coerce.number().int().min(1).max(24).default(3),
  isPublic: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  note: z.string().trim().max(1000).optional(),
})

export async function saveAdoption(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = adoptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const values = {
    projectId: data.projectId,
    donationId: data.donationId || null,
    donorName: data.donorName,
    donorEmail: data.donorEmail.toLowerCase(),
    donorOrganisation: data.donorOrganisation || null,
    startedOn: data.startedOn,
    endsOn: data.endsOn || null,
    amountMinor: toMinorUnits(data.amount, data.currency),
    currency: data.currency.toUpperCase(),
    updateEveryMonths: data.updateEveryMonths,
    isPublic: data.isPublic,
    isActive: data.isActive,
    note: data.note || null,
  }

  let id = data.id

  if (id) {
    await db
      .update(wellAdoptions)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(wellAdoptions.id, id))
  } else {
    const [created] = await db
      .insert(wellAdoptions)
      .values(values)
      .returning({ id: wellAdoptions.id })
    id = created!.id
  }

  revalidatePath('/admin/giving')
  return { ok: true, data: { id } }
}

export async function deleteAdoption(id: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  await db.delete(wellAdoptions).where(eq(wellAdoptions.id, id))
  revalidatePath('/admin/giving')
  return { ok: true }
}

// ------------------------------------------------------- legacy enquiries

export async function updateLegacyEnquiry(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('inquiries')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(['new', 'in_conversation', 'closed']),
      adminNote: z.string().trim().max(2000).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, error: 'invalid' }

  await db
    .update(legacyEnquiries)
    .set({
      status: parsed.data.status,
      adminNote: parsed.data.adminNote || null,
      updatedAt: new Date(),
    })
    .where(eq(legacyEnquiries.id, parsed.data.id))

  revalidatePath('/admin/legacies')
  return { ok: true }
}

// -------------------------------------------------------- recurring plans

/**
 * Admin-side changes to a standing gift.
 *
 * Deliberately narrow: staff can stop a plan and correct its schedule, but
 * changing someone's amount on their behalf is not offered — that is the
 * donor's decision, and they have their own link for it.
 */
export async function updateRecurringPlan(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(['active', 'paused', 'cancelled']),
      nextChargeOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullish(),
      cancelReason: z.string().trim().max(500).optional(),
    })
    .safeParse(input)

  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data

  await db
    .update(recurringPlans)
    .set({
      status: data.status,
      nextChargeOn: data.status === 'cancelled' ? null : (data.nextChargeOn ?? null),
      cancelledAt: data.status === 'cancelled' ? new Date() : null,
      cancelReason: data.cancelReason || null,
      updatedAt: new Date(),
    })
    .where(eq(recurringPlans.id, data.id))

  await recordAudit({
    actor: user,
    action: `recurring.${data.status}`,
    entityType: 'recurring_plan',
    entityId: data.id,
  })

  revalidatePath('/admin/giving')
  return { ok: true }
}
