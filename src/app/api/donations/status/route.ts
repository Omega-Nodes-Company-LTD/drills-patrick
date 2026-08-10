import { NextResponse } from 'next/server'
import { applyDonationStatus, getDonationByReference } from '@/lib/payments/donations'
import { getConfiguredProvider } from '@/lib/payments/registry'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'

/**
 * Polled by the donation status page. It re-asks the provider while the
 * donation is still open, which is what resolves mobile-money payments whose
 * callback never arrives.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get('ref')
  if (!reference) return NextResponse.json({ error: 'missing_reference' }, { status: 400 })

  const ip = await clientIdentifier()
  if (!rateLimit(`status:${ip}`, { limit: 120, windowMs: 5 * 60 * 1000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const donation = await getDonationByReference(reference)
  if (!donation) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let status = donation.status

  if (status === 'pending' || status === 'processing') {
    const provider = getConfiguredProvider(donation.provider as never)
    if (provider?.verifyStatus) {
      try {
        const next = await provider.verifyStatus(donation)
        if (next && next !== status) {
          const updated = await applyDonationStatus(donation.id, { status: next })
          status = updated?.status ?? next
        }
      } catch (error) {
        console.error('[donations/status] verification failed:', error)
      }
    }
  }

  return NextResponse.json(
    { reference: donation.reference, status },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
