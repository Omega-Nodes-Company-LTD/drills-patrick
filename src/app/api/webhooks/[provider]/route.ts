import { NextResponse } from 'next/server'
import {
  applyDonationStatus,
  getDonationByProviderRef,
  getDonationByReference,
  recordProviderEvent,
} from '@/lib/payments/donations'
import { getConfiguredProvider } from '@/lib/payments/registry'
import type { ProviderId } from '@/lib/payments/types'

/**
 * One endpoint per provider: `/api/webhooks/stripe`, `/api/webhooks/pesapal`, …
 *
 * Providers that are not configured return 404, so an unused endpoint gives
 * nothing away. Every processed event is stored with a unique key, which makes
 * replays no-ops.
 */

export const dynamic = 'force-dynamic'

const KNOWN: ProviderId[] = ['stripe', 'paypal', 'pesapal', 'mtn', 'airtel', 'bank']

async function handle(request: Request, providerId: string) {
  if (!KNOWN.includes(providerId as ProviderId)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  }

  const provider = getConfiguredProvider(providerId as ProviderId)
  if (!provider?.handleWebhook) {
    return NextResponse.json({ error: 'not_supported' }, { status: 404 })
  }

  let outcome
  try {
    outcome = await provider.handleWebhook(request)
  } catch (error) {
    console.error(`[webhook:${providerId}] rejected:`, error)
    // A signature failure must not be retried forever, but it must be visible.
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  if (!outcome) return NextResponse.json({ ignored: true })

  const donation = outcome.donationRef
    ? await getDonationByReference(outcome.donationRef)
    : outcome.providerRef
      ? await getDonationByProviderRef(provider.id, outcome.providerRef)
      : null

  const fresh = await recordProviderEvent({
    eventKey: outcome.eventKey,
    eventType: outcome.eventType,
    provider: provider.id,
    donationId: donation?.id ?? null,
    payload: outcome.payload,
    error: donation ? undefined : 'donation_not_found',
  })

  // Already handled: acknowledge so the provider stops retrying.
  if (!fresh) return NextResponse.json({ duplicate: true })

  if (donation && outcome.status) {
    await applyDonationStatus(donation.id, {
      status: outcome.status,
      providerRef: outcome.providerRef ?? donation.providerRef,
      feeMinor: outcome.feeMinor ?? null,
    })
  }

  return NextResponse.json({ received: true })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  return handle(request, provider)
}

/** PesaPal delivers its IPN as a GET with query parameters. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  return handle(request, provider)
}
