'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { donations } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { toMinorUnits } from '@/lib/money'
import { applyDonationStatus, createDonationReference } from '@/lib/payments/donations'
import { sendDonationReceipt } from '@/lib/mail/notifications'
import { manualDonationSchema } from '@/lib/validation/admin'
import type { ActionResult } from '@/lib/validation/public'

/** Bookkeeping actions for the donations ledger. */

export async function confirmDonation(id: string, note?: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const updated = await applyDonationStatus(id, {
    status: 'succeeded',
    confirmedById: user.id,
    adminNote: note ?? null,
  })

  if (!updated) return { ok: false, error: 'not_applicable' }

  await recordAudit({
    actor: user,
    action: 'donation.confirm',
    entityType: 'donation',
    entityId: id,
    summary: updated.reference,
  })

  revalidatePath('/[locale]/admin/donations', 'page')
  return { ok: true }
}

export async function markDonationFailed(id: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const updated = await applyDonationStatus(id, { status: 'cancelled', confirmedById: user.id })
  if (!updated) return { ok: false, error: 'not_applicable' }

  await recordAudit({
    actor: user,
    action: 'donation.cancel',
    entityType: 'donation',
    entityId: id,
    summary: updated.reference,
  })

  revalidatePath('/[locale]/admin/donations', 'page')
  return { ok: true }
}

export async function resendReceipt(id: string): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const [donation] = await db.select().from(donations).where(eq(donations.id, id)).limit(1)
  if (!donation) return { ok: false, error: 'not_found' }

  const sent = await sendDonationReceipt(donation)
  if (!sent) return { ok: false, error: 'mail_unavailable' }

  await db.update(donations).set({ receiptSentAt: new Date() }).where(eq(donations.id, id))

  await recordAudit({
    actor: user,
    action: 'donation.receipt',
    entityType: 'donation',
    entityId: id,
    summary: donation.reference,
  })

  return { ok: true }
}

/** Records a donation that arrived outside the platform (cash, cheque, grant). */
export async function recordManualDonation(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('donations')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = manualDonationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const data = parsed.data
  const currency = data.currency.toUpperCase()
  const reference = data.reference?.trim() || (await createDonationReference())

  const [created] = await db
    .insert(donations)
    .values({
      reference,
      provider: 'manual',
      status: 'pending',
      amountMinor: toMinorUnits(data.amount, currency),
      currency,
      campaignId: data.campaignId ?? null,
      donorName: data.donorName || null,
      donorEmail: data.donorEmail?.toLowerCase() || null,
      donorOrganisation: data.donorOrganisation || null,
      adminNote: data.adminNote || null,
      locale: data.locale,
    })
    .returning()

  if (created && data.markAsReceived) {
    await applyDonationStatus(created.id, { status: 'succeeded', confirmedById: user.id })
  }

  await recordAudit({
    actor: user,
    action: 'donation.manual',
    entityType: 'donation',
    entityId: created?.id,
    summary: reference,
  })

  revalidatePath('/[locale]/admin/donations', 'page')
  return { ok: true }
}
