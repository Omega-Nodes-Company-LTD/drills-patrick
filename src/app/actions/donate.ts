'use server'

import { absoluteUrl } from '@/lib/utils'
import { createDonation, setProviderRef } from '@/lib/payments/donations'
import { getConfiguredProvider } from '@/lib/payments/registry'
import { getSiteSettings } from '@/lib/settings/service'
import { toMinorUnits } from '@/lib/money'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { donationSchema, type DonationStartResult } from '@/lib/validation/donate'

/**
 * Starts a donation: validates the input, records a `pending` row, then asks
 * the chosen provider what should happen next (redirect, phone prompt, or bank
 * instructions).
 */
export async function startDonation(
  _prev: DonationStartResult | null,
  formData: FormData,
): Promise<DonationStartResult> {
  const parsed = donationSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  if (parsed.data.website) return { ok: false, error: 'invalid' }

  const ip = await clientIdentifier()
  if (!rateLimit(`donate:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 }).ok) {
    return { ok: false, error: 'rate_limited' }
  }

  const input = parsed.data
  const currency = input.currency.toUpperCase()
  const settings = await getSiteSettings()

  if (!settings.features.donations) return { ok: false, error: 'disabled' }
  if (!settings.donations.currencies.includes(currency)) {
    return { ok: false, error: 'invalid', fieldErrors: { currency: 'unsupported' } }
  }

  const minimum = settings.donations.minAmount[currency]
  if (minimum != null && input.amount < minimum) {
    return { ok: false, error: 'below_minimum', fieldErrors: { amount: String(minimum) } }
  }

  const provider = getConfiguredProvider(input.provider)
  if (!provider) return { ok: false, error: 'provider_unavailable' }

  if (provider.currencies && !provider.currencies.includes(currency)) {
    return { ok: false, error: 'currency_unsupported' }
  }

  if (provider.requiresPhone && !input.donorPhone) {
    return { ok: false, error: 'invalid', fieldErrors: { donorPhone: 'required' } }
  }

  const donation = await createDonation({
    amountMinor: toMinorUnits(input.amount, currency),
    currency,
    provider: input.provider,
    campaignId: input.campaignId || null,
    projectId: input.projectId || null,
    donorName: input.donorName || null,
    donorEmail: input.donorEmail || null,
    donorPhone: input.donorPhone || null,
    donorOrganisation: input.donorOrganisation || null,
    donorCountry: input.donorCountry || null,
    isAnonymous: input.isAnonymous,
    message: input.message || null,
    locale: input.locale,
  })

  const statusPath = `/${input.locale}/donate/status?ref=${encodeURIComponent(donation.reference)}`

  try {
    const result = await provider.createCheckout({
      donation,
      locale: input.locale,
      returnUrl: absoluteUrl(statusPath),
      cancelUrl: absoluteUrl(`${statusPath}&cancelled=1`),
      notifyUrl: absoluteUrl(`/api/webhooks/${provider.id}`),
    })

    if (result.providerRef) {
      await setProviderRef(donation.id, result.providerRef)
    }

    if (result.kind === 'redirect') return { ok: true, kind: 'redirect', url: result.url }
    if (result.kind === 'pending') return { ok: true, kind: 'pending', reference: donation.reference }
    return { ok: true, kind: 'instructions', reference: donation.reference }
  } catch (error) {
    console.error(`[donate] ${provider.id} checkout failed:`, error)
    return { ok: false, error: 'provider_error' }
  }
}
