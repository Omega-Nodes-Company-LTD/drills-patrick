import { env, features } from '@/env'
import { fromMinorUnits, currencyExponent } from '@/lib/money'
import type { DonationRow, DonationStatus } from '@/db/schema'
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentProvider,
  WebhookOutcome,
} from '../types'

/**
 * PesaPal API 3.0 — cards and East African mobile money in one hosted page.
 *
 * The IPN endpoint must be registered once per notification URL; the returned
 * `ipn_id` is cached in memory and re-registered automatically after a restart.
 */

const API = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  live: 'https://pay.pesapal.com/v3',
}

let token: { value: string; expiresAt: number } | null = null
let ipnId: string | null = null

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value

  const response = await fetch(`${API[env.PESAPAL_ENV]}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      consumer_key: env.PESAPAL_CONSUMER_KEY,
      consumer_secret: env.PESAPAL_CONSUMER_SECRET,
    }),
    cache: 'no-store',
  })

  const data = (await response.json()) as { token?: string; error?: unknown }
  if (!response.ok || !data.token) {
    throw new Error(`PesaPal auth failed: ${JSON.stringify(data.error ?? data)}`)
  }

  // Tokens are valid for five minutes.
  token = { value: data.token, expiresAt: Date.now() + 4 * 60 * 1000 }
  return token.value
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API[env.PESAPAL_ENV]}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) throw new Error(`PesaPal ${path} failed: ${response.status} ${text}`)
  return JSON.parse(text) as T
}

async function ensureIpn(notifyUrl: string): Promise<string> {
  if (ipnId) return ipnId

  const registered = await call<{ ipn_id: string }>('/api/URLSetup/RegisterIPN', {
    method: 'POST',
    body: JSON.stringify({ url: notifyUrl, ipn_notification_type: 'GET' }),
  })

  ipnId = registered.ipn_id
  return ipnId
}

function mapStatus(code: number | string | undefined): DonationStatus {
  // 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED
  switch (Number(code)) {
    case 1:
      return 'succeeded'
    case 2:
      return 'failed'
    case 3:
      return 'refunded'
    default:
      return 'processing'
  }
}

export const pesapalProvider: PaymentProvider = {
  id: 'pesapal',
  currencies: ['UGX', 'KES', 'TZS', 'RWA', 'USD'],

  isConfigured() {
    return features.pesapal
  },

  async createCheckout({
    donation,
    returnUrl,
    notifyUrl,
  }: CheckoutInput): Promise<CheckoutResult> {
    const notificationId = await ensureIpn(notifyUrl)
    const exponent = currencyExponent(donation.currency)

    const order = await call<{
      order_tracking_id: string
      redirect_url: string
      error?: unknown
    }>('/api/Transactions/SubmitOrderRequest', {
      method: 'POST',
      body: JSON.stringify({
        id: donation.reference,
        currency: donation.currency.toUpperCase(),
        amount: Number(fromMinorUnits(donation.amountMinor, donation.currency).toFixed(exponent)),
        description: `Donation ${donation.reference}`.slice(0, 100),
        callback_url: returnUrl,
        notification_id: notificationId,
        billing_address: {
          email_address: donation.donorEmail ?? undefined,
          phone_number: donation.donorPhone ?? undefined,
          first_name: donation.donorName?.split(' ')[0],
          last_name: donation.donorName?.split(' ').slice(1).join(' ') || undefined,
        },
      }),
    })

    if (!order.redirect_url) {
      throw new Error(`PesaPal rejected the order: ${JSON.stringify(order.error)}`)
    }

    return {
      kind: 'redirect',
      url: order.redirect_url,
      providerRef: order.order_tracking_id,
    }
  },

  async verifyStatus(donation: DonationRow): Promise<DonationStatus | null> {
    if (!donation.providerRef) return null

    const status = await call<{ status_code: number; payment_status_description?: string }>(
      `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(donation.providerRef)}`,
    )

    return mapStatus(status.status_code)
  },

  /**
   * PesaPal calls the IPN with query parameters; the payload itself carries no
   * outcome, so the status is fetched right after.
   */
  async handleWebhook(request: Request): Promise<WebhookOutcome | null> {
    const url = new URL(request.url)
    const trackingId = url.searchParams.get('OrderTrackingId')
    const merchantRef = url.searchParams.get('OrderMerchantReference')
    if (!trackingId) return null

    const status = await call<{ status_code: number }>(
      `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`,
    )

    return {
      eventKey: `pesapal:${trackingId}:${status.status_code}`,
      eventType: 'ipn',
      donationRef: merchantRef ?? undefined,
      providerRef: trackingId,
      status: mapStatus(status.status_code),
      payload: { trackingId, statusCode: status.status_code },
    }
  },
}
