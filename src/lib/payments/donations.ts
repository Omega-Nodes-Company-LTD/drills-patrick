import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  campaigns,
  donationEvents,
  donations,
  type DonationRow,
  type DonationStatus,
  type PaymentProviderId,
} from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { sendDonationReceipt } from '@/lib/mail/notifications'
import { getSiteSettings } from '@/lib/settings/service'

/**
 * Donation lifecycle: creation, provider callbacks and the bookkeeping that
 * keeps `campaigns.raisedAmount` in step with the succeeded donations.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomToken(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export async function createDonationReference(): Promise<string> {
  const settings = await getSiteSettings()
  const prefix = (settings.donations.receiptPrefix || 'WC').toUpperCase()
  return `${prefix}-${new Date().getFullYear()}-${randomToken()}`
}

export type CreateDonationInput = {
  amountMinor: number
  currency: string
  provider: PaymentProviderId
  campaignId?: string | null
  projectId?: string | null
  donorName?: string | null
  donorEmail?: string | null
  donorPhone?: string | null
  donorOrganisation?: string | null
  donorCountry?: string | null
  isAnonymous?: boolean
  message?: string | null
  locale: Locale
  metadata?: Record<string, unknown>
}

export async function createDonation(input: CreateDonationInput): Promise<DonationRow> {
  const reference = await createDonationReference()

  const [row] = await db
    .insert(donations)
    .values({
      reference,
      provider: input.provider,
      status: 'pending',
      amountMinor: input.amountMinor,
      currency: input.currency.toUpperCase(),
      campaignId: input.campaignId ?? null,
      projectId: input.projectId ?? null,
      donorName: input.donorName ?? null,
      donorEmail: input.donorEmail?.toLowerCase() ?? null,
      donorPhone: input.donorPhone ?? null,
      donorOrganisation: input.donorOrganisation ?? null,
      donorCountry: input.donorCountry ?? null,
      isAnonymous: input.isAnonymous ?? false,
      message: input.message ?? null,
      locale: input.locale,
      metadata: input.metadata ?? {},
    })
    .returning()

  return row!
}

export async function getDonationByReference(reference: string): Promise<DonationRow | null> {
  const [row] = await db.select().from(donations).where(eq(donations.reference, reference)).limit(1)
  return row ?? null
}

export async function getDonationByProviderRef(
  provider: PaymentProviderId,
  providerRef: string,
): Promise<DonationRow | null> {
  const [row] = await db
    .select()
    .from(donations)
    .where(and(eq(donations.provider, provider), eq(donations.providerRef, providerRef)))
    .limit(1)
  return row ?? null
}

export async function setProviderRef(donationId: string, providerRef: string): Promise<void> {
  await db.update(donations).set({ providerRef }).where(eq(donations.id, donationId))
}

async function nextReceiptNumber(): Promise<string> {
  const settings = await getSiteSettings()
  const prefix = (settings.donations.receiptPrefix || 'WC').toUpperCase()
  const [row] = await db.execute<{ nextval: string }>(sql`SELECT nextval('donation_receipt_seq')`)
  return `${prefix}-${String(row?.nextval ?? '0').padStart(6, '0')}`
}

/**
 * Recomputes the cached total from the donations themselves rather than
 * incrementing, so a replayed webhook or a manual correction can never drift.
 */
export async function recomputeCampaignTotal(campaignId: string): Promise<void> {
  await db.execute(sql`
    UPDATE campaigns SET raised_amount = COALESCE((
      SELECT SUM(amount_minor) FROM donations
      WHERE campaign_id = ${campaignId} AND status = 'succeeded'
    ), 0)
    WHERE id = ${campaignId}
  `)
}

export type StatusChange = {
  status: DonationStatus
  providerRef?: string | null
  feeMinor?: number | null
  confirmedById?: string | null
  adminNote?: string | null
}

/**
 * Applies a status transition. Returns the updated row, or `null` when the
 * transition was a no-op (already in that state) so callers can skip side
 * effects such as sending a second receipt.
 */
export async function applyDonationStatus(
  donationId: string,
  change: StatusChange,
): Promise<DonationRow | null> {
  const [current] = await db.select().from(donations).where(eq(donations.id, donationId)).limit(1)
  if (!current) return null
  if (current.status === change.status) return null

  // A donation that already succeeded only moves on to a refund.
  if (current.status === 'succeeded' && change.status !== 'refunded') return null

  const becameSuccessful = change.status === 'succeeded'
  const receiptNumber =
    becameSuccessful && !current.receiptNumber ? await nextReceiptNumber() : current.receiptNumber

  const [updated] = await db
    .update(donations)
    .set({
      status: change.status,
      providerRef: change.providerRef ?? current.providerRef,
      feeMinor: change.feeMinor ?? current.feeMinor,
      confirmedById: change.confirmedById ?? current.confirmedById,
      adminNote: change.adminNote ?? current.adminNote,
      receiptNumber,
      confirmedAt: becameSuccessful ? new Date() : current.confirmedAt,
    })
    .where(eq(donations.id, donationId))
    .returning()

  if (!updated) return null

  if (updated.campaignId) {
    await recomputeCampaignTotal(updated.campaignId)
  }

  if (becameSuccessful) {
    const sent = await sendDonationReceipt(updated)
    if (sent) {
      await db
        .update(donations)
        .set({ receiptSentAt: new Date() })
        .where(eq(donations.id, updated.id))
    }
  }

  return updated
}

/**
 * Records a provider event exactly once. Returns false when the event was
 * already stored, which is how webhook replays are ignored.
 */
export async function recordProviderEvent(params: {
  eventKey: string
  eventType: string
  provider: PaymentProviderId
  donationId?: string | null
  payload?: Record<string, unknown>
  error?: string
}): Promise<boolean> {
  const inserted = await db
    .insert(donationEvents)
    .values({
      eventKey: params.eventKey,
      eventType: params.eventType,
      provider: params.provider,
      donationId: params.donationId ?? null,
      payload: params.payload ?? null,
      processedAt: new Date(),
      error: params.error ?? null,
    })
    .onConflictDoNothing({ target: donationEvents.eventKey })
    .returning({ id: donationEvents.id })

  return inserted.length > 0
}

/** Campaign totals shown on the public pages include offline contributions. */
export async function campaignTotals(campaignId: string) {
  const [row] = await db
    .select({
      goal: campaigns.goalAmount,
      raised: campaigns.raisedAmount,
      offline: campaigns.offlineAmount,
      currency: campaigns.currency,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1)

  return row ?? null
}
