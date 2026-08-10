import { env, features } from '@/env'
import { fromMinorUnits, currencyExponent } from '@/lib/money'
import type { DonationRow, DonationStatus } from '@/db/schema'
import type { CheckoutInput, CheckoutResult, PaymentProvider } from '../types'

/**
 * PayPal Orders v2 with a redirect flow. The order is captured when the donor
 * comes back to the status page, so no webhook signature verification is
 * needed — the capture call itself is the source of truth.
 */

const API = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
}

// PayPal only settles in currencies with two decimals (and a few zero-decimal
// ones we do not use); UGX is not supported.
const SUPPORTED = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN']

let token: { value: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value

  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`,
  ).toString('base64')

  const response = await fetch(`${API[env.PAYPAL_ENV]}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return token.value
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API[env.PAYPAL_ENV]}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`PayPal ${path} failed: ${response.status} ${text}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

type PayPalOrder = {
  id: string
  status: string
  links?: { href: string; rel: string; method: string }[]
  purchase_units?: {
    payments?: {
      captures?: {
        status: string
        seller_receivable_breakdown?: { paypal_fee?: { value: string; currency_code: string } }
      }[]
    }
  }[]
}

function mapStatus(status: string): DonationStatus {
  switch (status) {
    case 'COMPLETED':
      return 'succeeded'
    case 'APPROVED':
    case 'SAVED':
    case 'PAYER_ACTION_REQUIRED':
      return 'processing'
    case 'VOIDED':
      return 'cancelled'
    default:
      return 'processing'
  }
}

export const paypalProvider: PaymentProvider = {
  id: 'paypal',
  currencies: SUPPORTED,

  isConfigured() {
    return features.paypal
  },

  async createCheckout({
    donation,
    returnUrl,
    cancelUrl,
  }: CheckoutInput): Promise<CheckoutResult> {
    const exponent = currencyExponent(donation.currency)
    const value = fromMinorUnits(donation.amountMinor, donation.currency).toFixed(exponent)

    const order = await call<PayPalOrder>('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: donation.reference,
            custom_id: donation.reference,
            description: `Donation ${donation.reference}`.slice(0, 127),
            amount: { currency_code: donation.currency.toUpperCase(), value },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: 'PAY_NOW',
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }),
    })

    const approve = order.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')
    if (!approve) throw new Error('PayPal did not return an approval link')

    return { kind: 'redirect', url: approve.href, providerRef: order.id }
  },

  /**
   * Called when the donor returns and by the reconciliation job. An approved
   * order is captured here; an already-captured one simply reports its status.
   */
  async verifyStatus(donation: DonationRow): Promise<DonationStatus | null> {
    if (!donation.providerRef) return null

    const order = await call<PayPalOrder>(`/v2/checkout/orders/${donation.providerRef}`)

    if (order.status === 'APPROVED') {
      const captured = await call<PayPalOrder>(
        `/v2/checkout/orders/${donation.providerRef}/capture`,
        { method: 'POST', body: '{}' },
      )
      return mapStatus(captured.status)
    }

    return mapStatus(order.status)
  },
}
