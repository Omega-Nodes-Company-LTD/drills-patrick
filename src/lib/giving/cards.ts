import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { giftCards } from '@/db/schema'
import { hashToken } from '@/lib/giving/tokens'

/**
 * Looks up a card by the token in its URL.
 *
 * Matched on the hash rather than scanning and comparing: the hash column is
 * indexed by its uniqueness and the lookup is a single equality, so there is
 * no timing signal and no table walk. A card that has not been sent yet is not
 * returned — the sender chose a date, and a forwarded link must not jump it.
 */
export async function giftCardByToken(token: string) {
  if (!token || token.length < 16) return null

  const [card] = await db
    .select()
    .from(giftCards)
    .where(eq(giftCards.viewTokenHash, hashToken(token)))
    .limit(1)

  if (!card || !card.sentAt) return null
  return card
}
