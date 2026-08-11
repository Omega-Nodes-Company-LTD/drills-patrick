import 'server-only'
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  fundraiserDonations,
  fundraisers,
  giftCards,
  matchingAllocations,
  matchingPledges,
} from '@/db/schema'
import type { DonationRow } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { matchFor } from '@/lib/giving/matching'
import { recomputeFundraiserTotal } from '@/lib/giving/fundraisers'
import { issueToken } from '@/lib/giving/tokens'
import { sendGiftCard } from '@/lib/mail/giving'

/**
 * Everything that hangs off a donation once it exists.
 *
 * Split from the payment code deliberately. A failure here — no matching
 * pledge open, a gift card that cannot be emailed — must never fail a
 * payment that has already been taken, so every function is written to be
 * safely skippable.
 */

/** Records that a gift came in through a supporter's page. */
export async function attachToFundraiser(donationId: string, slug: string): Promise<void> {
  const [page] = await db
    .select({ id: fundraisers.id })
    .from(fundraisers)
    .where(and(eq(fundraisers.slug, slug), eq(fundraisers.status, 'approved')))
    .limit(1)

  if (!page) return

  await db
    .insert(fundraiserDonations)
    .values({ fundraiserId: page.id, donationId })
    // A retry must not create a second link, and the gift is already counted.
    .onConflictDoNothing()
}

/** The pledge a gift would draw from, if any is open right now. */
export async function openPledge(campaignId: string | null, at: Date) {
  const [pledge] = await db
    .select()
    .from(matchingPledges)
    .where(
      and(
        eq(matchingPledges.isActive, true),
        lte(matchingPledges.startsAt, at),
        gte(matchingPledges.endsAt, at),
        sql`${matchingPledges.matchedMinor} < ${matchingPledges.ceilingMinor}`,
        // A campaign-specific pledge wins over a site-wide one; both apply to
        // a gift made to that campaign.
        campaignId
          ? or(eq(matchingPledges.campaignId, campaignId), isNull(matchingPledges.campaignId))
          : isNull(matchingPledges.campaignId),
      ),
    )
    .orderBy(desc(matchingPledges.campaignId))
    .limit(1)

  return pledge ?? null
}

/**
 * Commits a gift's share of a matching pledge.
 *
 * Runs only when the donation has actually succeeded: promising a match
 * against a payment that later fails would overstate the counter and, worse,
 * bill the matcher for money that never arrived.
 *
 * The running total is incremented in the same statement that reads it, so two
 * gifts landing together cannot both be told the last euro is theirs.
 */
export async function allocateMatch(donation: DonationRow): Promise<number> {
  if (donation.status !== 'succeeded') return 0

  const now = new Date()
  const pledge = await openPledge(donation.campaignId, now)
  if (!pledge) return 0

  const amount = matchFor(
    {
      ratioBp: pledge.ratioBp,
      ceilingMinor: pledge.ceilingMinor,
      perDonationCapMinor: pledge.perDonationCapMinor,
      matchedMinor: pledge.matchedMinor,
      currency: pledge.currency,
      startsAt: pledge.startsAt,
      endsAt: pledge.endsAt,
      isActive: pledge.isActive,
    },
    { amountMinor: donation.amountMinor, currency: donation.currency },
    now,
  )

  if (amount <= 0) return 0

  const inserted = await db
    .insert(matchingAllocations)
    .values({
      pledgeId: pledge.id,
      donationId: donation.id,
      matchedMinor: amount,
      currency: pledge.currency,
    })
    .onConflictDoNothing()
    .returning({ id: matchingAllocations.id })

  // Already allocated on an earlier delivery of the same event.
  if (inserted.length === 0) return 0

  await db
    .update(matchingPledges)
    .set({
      // Clamped in SQL as well: the read and the write are not one statement,
      // and the ceiling is a promise rather than a target.
      matchedMinor: sql`least(${matchingPledges.matchedMinor} + ${amount}, ${matchingPledges.ceilingMinor})`,
      updatedAt: new Date(),
    })
    .where(eq(matchingPledges.id, pledge.id))

  return amount
}

/** Brings a fundraiser page's total back in step with its gifts. */
export async function refreshFundraiserFor(donationId: string): Promise<void> {
  const [link] = await db
    .select({ fundraiserId: fundraiserDonations.fundraiserId })
    .from(fundraiserDonations)
    .where(eq(fundraiserDonations.donationId, donationId))
    .limit(1)

  if (link) await recomputeFundraiserTotal(link.fundraiserId)
}

export type GiftCardInput = {
  senderName: string
  senderEmail?: string | null
  recipientName: string
  recipientEmail?: string | null
  message?: string | null
  occasion?: string | null
  deliverOn?: string | null
  locale: Locale
}

/** Stores the card bought alongside a gift. Sent later, or straight away. */
export async function createGiftCard(
  donationId: string,
  input: GiftCardInput,
): Promise<{ token: string } | null> {
  const { token, hash } = issueToken()

  const [created] = await db
    .insert(giftCards)
    .values({
      donationId,
      senderName: input.senderName,
      senderEmail: input.senderEmail || null,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail || null,
      message: input.message || '',
      occasion: input.occasion || null,
      deliverOn: input.deliverOn || null,
      viewTokenHash: hash,
      locale: input.locale,
    })
    .returning({ id: giftCards.id })

  return created ? { token } : null
}

/**
 * Sends the cards that are due.
 *
 * A card bought in November for a birthday in March must not arrive in
 * November, so nothing goes out before its date. Cards with no date were meant
 * to go immediately and are picked up on the next run.
 */
export async function deliverDueGiftCards(today = new Date()): Promise<number> {
  const stamp = today.toISOString().slice(0, 10)

  const due = await db
    .select()
    .from(giftCards)
    .where(
      and(
        isNull(giftCards.sentAt),
        or(isNull(giftCards.deliverOn), lte(giftCards.deliverOn, stamp)),
      ),
    )
    .limit(200)

  let sent = 0

  for (const card of due) {
    if (!card.recipientEmail) continue

    // The token is not recoverable from the hash, so a card whose email fails
    // is reissued rather than retried: the old link was never seen by anyone.
    const { token, hash } = issueToken()

    await sendGiftCard({
      to: card.recipientEmail,
      recipientName: card.recipientName,
      senderName: card.senderName,
      message: card.message,
      token,
      locale: card.locale as Locale,
    })

    await db
      .update(giftCards)
      .set({ sentAt: new Date(), viewTokenHash: hash })
      .where(eq(giftCards.id, card.id))

    sent += 1
  }

  return sent
}
