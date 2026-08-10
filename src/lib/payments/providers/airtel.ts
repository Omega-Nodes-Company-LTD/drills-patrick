import { env, features } from '@/env'
import { fromMinorUnits } from '@/lib/money'
import type { DonationRow, DonationStatus } from '@/db/schema'
import type { CheckoutInput, CheckoutResult, PaymentProvider } from '../types'

/**
 * Airtel Money collections. Like MTN this is a push-to-phone flow: the donor
 * approves on the handset and we poll for the outcome.
 */

const API = {
  sandbox: 'https://openapiuat.airtel.africa',
  live: 'https://openapi.airtel.africa',
}

let token: { value: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value

  const response = await fetch(`${API[env.AIRTEL_ENV]}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    body: JSON.stringify({
      client_id: env.AIRTEL_CLIENT_ID,
      client_secret: env.AIRTEL_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Airtel auth failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: string | number }
  token = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  }
  return token.value
}

function headers(extra: Record<string, string> = {}) {
  return {
    'Content-Type': 'application/json',
    Accept: '*/*',
    'X-Country': env.AIRTEL_COUNTRY,
    'X-Currency': env.AIRTEL_CURRENCY,
    ...extra,
  }
}

function mapStatus(code: string | undefined): DonationStatus {
  // TS = transaction success, TF = failed, TA = ambiguous, TIP = in progress
  switch (code) {
    case 'TS':
      return 'succeeded'
    case 'TF':
    case 'TE':
      return 'failed'
    default:
      return 'processing'
  }
}

/** Airtel expects the national number without the country code. */
function normalisePhone(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  return digits.startsWith('256') ? digits.slice(3) : digits.replace(/^0+/, '')
}

export const airtelProvider: PaymentProvider = {
  id: 'airtel',
  currencies: ['UGX'],
  requiresPhone: true,

  isConfigured() {
    return features.airtel
  },

  async createCheckout({ donation }: CheckoutInput): Promise<CheckoutResult> {
    if (!donation.donorPhone) throw new Error('A phone number is required for Airtel Money')

    const response = await fetch(`${API[env.AIRTEL_ENV]}/merchant/v1/payments/`, {
      method: 'POST',
      headers: headers({ Authorization: `Bearer ${await accessToken()}` }),
      body: JSON.stringify({
        reference: donation.reference,
        subscriber: {
          country: env.AIRTEL_COUNTRY,
          currency: env.AIRTEL_CURRENCY,
          msisdn: normalisePhone(donation.donorPhone),
        },
        transaction: {
          amount: Math.round(fromMinorUnits(donation.amountMinor, donation.currency)),
          country: env.AIRTEL_COUNTRY,
          currency: env.AIRTEL_CURRENCY,
          id: donation.reference,
        },
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Airtel payment failed: ${response.status} ${await response.text()}`)
    }

    return { kind: 'pending', providerRef: donation.reference }
  },

  async verifyStatus(donation: DonationRow): Promise<DonationStatus | null> {
    const reference = donation.providerRef ?? donation.reference

    const response = await fetch(
      `${API[env.AIRTEL_ENV]}/standard/v1/payments/${encodeURIComponent(reference)}`,
      { headers: headers({ Authorization: `Bearer ${await accessToken()}` }), cache: 'no-store' },
    )

    if (!response.ok) return null

    const data = (await response.json()) as {
      data?: { transaction?: { status?: string } }
    }
    return mapStatus(data.data?.transaction?.status)
  },
}
