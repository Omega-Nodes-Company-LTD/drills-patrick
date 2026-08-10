import { and, inArray, lt, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { donations } from '@/db/schema'
import { env } from '@/env'
import { applyDonationStatus } from '@/lib/payments/donations'
import { getConfiguredProvider } from '@/lib/payments/registry'
import type { ProviderId } from '@/lib/payments/types'

/**
 * Reconciliation job.
 *
 * Mobile-money callbacks are unreliable and browsers get closed mid-payment, so
 * every donation left open is re-checked against its provider. Schedule it in
 * Coolify (every 10 minutes is plenty):
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/cron/reconcile-donations
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Donations older than this are abandoned rather than polled forever. */
const STALE_AFTER_HOURS = 48

function authorised(request: Request): boolean {
  if (!env.CRON_SECRET) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const open = await db
    .select()
    .from(donations)
    .where(
      and(
        inArray(donations.status, ['pending', 'processing']),
        // Bank transfers are confirmed by a human, never by polling.
        sql`${donations.provider} <> 'bank'`,
        sql`${donations.createdAt} > now() - interval '${sql.raw(String(STALE_AFTER_HOURS))} hours'`,
      ),
    )
    .limit(200)

  let checked = 0
  let updated = 0
  const errors: string[] = []

  for (const donation of open) {
    const provider = getConfiguredProvider(donation.provider as ProviderId)
    if (!provider?.verifyStatus) continue

    checked += 1
    try {
      const status = await provider.verifyStatus(donation)
      if (status && status !== donation.status) {
        const result = await applyDonationStatus(donation.id, { status })
        if (result) updated += 1
      }
    } catch (error) {
      errors.push(`${donation.reference}: ${error instanceof Error ? error.message : 'unknown'}`)
    }
  }

  // Anything still open past the window is closed so the list stays meaningful.
  const expired = await db
    .update(donations)
    .set({ status: 'cancelled' })
    .where(
      and(
        inArray(donations.status, ['pending', 'processing']),
        sql`${donations.provider} <> 'bank'`,
        lt(donations.createdAt, new Date(Date.now() - STALE_AFTER_HOURS * 3600_000)),
      ),
    )
    .returning({ id: donations.id })

  return NextResponse.json({
    checked,
    updated,
    expired: expired.length,
    errors: errors.slice(0, 20),
  })
}
