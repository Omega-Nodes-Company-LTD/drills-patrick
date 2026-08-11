'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { fundraisers, legacyEnquiries, recurringPlans } from '@/db/schema'
import { getFundraiserByToken, uniqueFundraiserSlug } from '@/lib/giving/fundraisers'
import { issueToken, tokenMatches } from '@/lib/giving/tokens'
import { advance, nextChargeAfter } from '@/lib/giving/schedule'
import { notifyFundraiserStarted, notifyLegacyEnquiry, sendFundraiserLink } from '@/lib/mail/giving'
import { toMinorUnits } from '@/lib/money'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { getSiteSettings } from '@/lib/settings/service'
import {
  fundraiserEditSchema,
  fundraiserStartSchema,
  legacyEnquirySchema,
  recurringManageSchema,
} from '@/lib/validation/giving'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Supporter-facing giving forms.
 *
 * All rate limited per IP and carrying a honeypot, like the other public
 * forms. Nothing here trusts an id from the client on its own: every action
 * that changes an existing record proves ownership with a token first.
 */

async function guard(scope: string, limit = 5): Promise<boolean> {
  const ip = await clientIdentifier()
  return rateLimit(`${scope}:${ip}`, { limit, windowMs: 10 * 60 * 1000 }).ok
}

// -------------------------------------------------------- peer-to-peer page

export async function startFundraiser(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = fundraiserStartSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }
  if (parsed.data.website) return { ok: true, data: { slug: '' } }
  if (!(await guard('fundraiser'))) return { ok: false, error: 'rate_limited' }

  const input = parsed.data
  const settings = await getSiteSettings()
  if (!settings.features.donations) return { ok: false, error: 'disabled' }

  const currency = input.currency.toUpperCase()
  if (!settings.donations.currencies.includes(currency)) {
    return { ok: false, error: 'invalid', fieldErrors: { currency: 'unsupported' } }
  }

  const slug = await uniqueFundraiserSlug(input.title, input.ownerName)
  const { token, hash } = issueToken()

  await db.insert(fundraisers).values({
    slug,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail.toLowerCase(),
    title: input.title,
    story: input.story,
    campaignId: input.campaignId || null,
    projectId: input.projectId || null,
    goalAmountMinor: toMinorUnits(input.goalAmount, currency),
    currency,
    // Held for review: these pages carry the organisation's name.
    status: 'pending',
    manageTokenHash: hash,
    locale: input.locale,
    endsOn: input.endsOn || null,
  })

  // The link is the only copy of the token, so it goes out before anything
  // else can fail. A page the owner cannot edit is worse than no page.
  await sendFundraiserLink({
    to: input.ownerEmail,
    ownerName: input.ownerName,
    title: input.title,
    slug,
    token,
    locale: input.locale,
  })
  await notifyFundraiserStarted({ title: input.title, ownerName: input.ownerName, slug })

  revalidatePath('/fundraisers')
  return { ok: true, data: { slug } }
}

export async function editFundraiser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = fundraiserEditSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  if (!(await guard('fundraiser-edit', 20))) return { ok: false, error: 'rate_limited' }

  const input = parsed.data
  const row = await getFundraiserByToken(input.slug, input.token)
  if (!row) return { ok: false, error: 'not_found' }

  await db
    .update(fundraisers)
    .set({
      title: input.title,
      story: input.story,
      goalAmountMinor: toMinorUnits(input.goalAmount, row.currency),
      endsOn: input.endsOn || null,
      updatedAt: new Date(),
    })
    .where(eq(fundraisers.id, row.id))

  revalidatePath(`/fundraisers/${row.slug}`)
  return { ok: true }
}

export async function closeFundraiser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = String(formData.get('slug') ?? '')
  const token = String(formData.get('token') ?? '')
  if (!(await guard('fundraiser-edit', 20))) return { ok: false, error: 'rate_limited' }

  const row = await getFundraiserByToken(slug, token)
  if (!row) return { ok: false, error: 'not_found' }

  await db
    .update(fundraisers)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(fundraisers.id, row.id))

  revalidatePath('/fundraisers')
  return { ok: true }
}

// ------------------------------------------------------ legacies and major

export async function submitLegacyEnquiry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = legacyEnquirySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  if (parsed.data.website) return { ok: true }
  if (!(await guard('legacy'))) return { ok: false, error: 'rate_limited' }

  const input = parsed.data

  await db.insert(legacyEnquiries).values({
    kind: input.kind,
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    country: input.country || null,
    organisation: input.organisation || null,
    preferredContact: input.preferredContact || null,
    message: input.message,
    locale: input.locale,
  })

  await notifyLegacyEnquiry(input)
  return { ok: true }
}

// ------------------------------------------------------------- recurring

/**
 * The donor's own controls on a standing gift.
 *
 * Pausing and cancelling take effect immediately and ask for nothing in
 * return. The reason field is optional and never blocks the action: a donor
 * who has to justify stopping simply stops answering email instead.
 */
export async function manageRecurring(
  _prev: ActionResult<{ status: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ status: string }>> {
  const parsed = recurringManageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  if (!(await guard('recurring', 20))) return { ok: false, error: 'rate_limited' }

  const input = parsed.data

  const [plan] = await db
    .select()
    .from(recurringPlans)
    .where(eq(recurringPlans.reference, input.reference))
    .limit(1)

  if (!plan || !tokenMatches(input.token, plan.manageTokenHash)) {
    return { ok: false, error: 'not_found' }
  }
  if (plan.status === 'cancelled') return { ok: false, error: 'cancelled' }

  const today = new Date()

  if (input.action === 'cancel') {
    await db
      .update(recurringPlans)
      .set({
        status: 'cancelled',
        cancelledAt: today,
        cancelReason: input.reason || null,
        nextChargeOn: null,
        updatedAt: today,
      })
      .where(eq(recurringPlans.id, plan.id))

    return { ok: true, data: { status: 'cancelled' } }
  }

  if (input.action === 'pause') {
    await db
      .update(recurringPlans)
      .set({
        status: 'paused',
        pausedUntil: input.resumeOn || null,
        cancelReason: input.reason || null,
        updatedAt: today,
      })
      .where(eq(recurringPlans.id, plan.id))

    return { ok: true, data: { status: 'paused' } }
  }

  if (input.action === 'resume') {
    // Catches up to today rather than replaying every missed month: the donor
    // agreed to give monthly, not to owe a backlog.
    const from = plan.nextChargeOn ? new Date(`${plan.nextChargeOn}T00:00:00Z`) : today
    const next =
      from > today
        ? plan.nextChargeOn!
        : nextChargeAfter({ from, interval: plan.interval, today })

    await db
      .update(recurringPlans)
      .set({ status: 'active', pausedUntil: null, nextChargeOn: next, updatedAt: today })
      .where(eq(recurringPlans.id, plan.id))

    return { ok: true, data: { status: 'active' } }
  }

  if (input.amount === undefined) return { ok: false, error: 'invalid' }

  const settings = await getSiteSettings()
  const minimum = settings.donations.minAmount[plan.currency]
  if (minimum != null && input.amount < minimum) {
    return { ok: false, error: 'below_minimum', fieldErrors: { amount: String(minimum) } }
  }

  await db
    .update(recurringPlans)
    .set({
      amountMinor: toMinorUnits(input.amount, plan.currency),
      // An amount change on a plan with no schedule yet needs one.
      nextChargeOn: plan.nextChargeOn ?? advance(today, plan.interval),
      updatedAt: today,
    })
    .where(eq(recurringPlans.id, plan.id))

  return { ok: true, data: { status: plan.status } }
}
