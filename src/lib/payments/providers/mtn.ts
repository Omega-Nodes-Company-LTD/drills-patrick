import { env, features } from '@/env'
import { fromMinorUnits } from '@/lib/money'
import type { DonationRow, DonationStatus } from '@/db/schema'
import type { CheckoutInput, CheckoutResult, PaymentProvider } from '../types'

/**
 * MTN MoMo Collections — "request to pay".
 *
 * The donor confirms on their handset, so there is nothing to redirect to. The
 * callback is unreliable in practice, so the status page and the reconciliation
 * job both poll `GET /requesttopay/{referenceId}`.
 */

const API = {
  sandbox: 'https://sandbox.momodeveloper.mtn.com',
  live: 'https://proxy.momoapi.mtn.com',
}

let token: { value: string; expiresAt: number } | null = null

function targetEnvironment(): string {
  return env.MTN_MOMO_TARGET_ENVIRONMENT ?? (env.MTN_MOMO_ENV === 'live' ? 'mtnuganda' : 'sandbox')
}

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value

  const credentials = Buffer.from(
    `${env.MTN_MOMO_API_USER}:${env.MTN_MOMO_API_KEY}`,
  ).toString('base64')

  const response = await fetch(`${API[env.MTN_MOMO_ENV]}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY!,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`MTN auth failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return token.value
}

function mapStatus(status: string | undefined): DonationStatus {
  switch (status) {
    case 'SUCCESSFUL':
      return 'succeeded'
    case 'FAILED':
    case 'REJECTED':
      return 'failed'
    case 'TIMEOUT':
      return 'cancelled'
    default:
      return 'processing'
  }
}

/** MoMo expects a local MSISDN without the leading `+` or `00`. */
function normalisePhone(value: string): string {
  return value.replace(/[^\d]/g, '').replace(/^0+/, '')
}

export const mtnProvider: PaymentProvider = {
  id: 'mtn',
  currencies: ['UGX', 'EUR'],
  requiresPhone: true,

  isConfigured() {
    return features.mtn
  },

  async createCheckout({ donation, notifyUrl }: CheckoutInput): Promise<CheckoutResult> {
    if (!donation.donorPhone) throw new Error('A phone number is required for MTN Mobile Money')

    // The reference id we generate is the handle used for every later lookup.
    const referenceId = crypto.randomUUID()
    // The sandbox only settles in EUR.
    const currency = env.MTN_MOMO_ENV === 'sandbox' ? 'EUR' : donation.currency.toUpperCase()

    const response = await fetch(`${API[env.MTN_MOMO_ENV]}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': targetEnvironment(),
        'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY!,
        'X-Callback-Url': notifyUrl,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(Math.round(fromMinorUnits(donation.amountMinor, donation.currency))),
        currency,
        externalId: donation.reference,
        payer: { partyIdType: 'MSISDN', partyId: normalisePhone(donation.donorPhone) },
        payerMessage: `Donation ${donation.reference}`.slice(0, 60),
        payeeNote: donation.reference,
      }),
      cache: 'no-store',
    })

    if (response.status !== 202) {
      throw new Error(`MTN requestToPay failed: ${response.status} ${await response.text()}`)
    }

    return { kind: 'pending', providerRef: referenceId }
  },

  async verifyStatus(donation: DonationRow): Promise<DonationStatus | null> {
    if (!donation.providerRef) return null

    const response = await fetch(
      `${API[env.MTN_MOMO_ENV]}/collection/v1_0/requesttopay/${donation.providerRef}`,
      {
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'X-Target-Environment': targetEnvironment(),
          'Ocp-Apim-Subscription-Key': env.MTN_MOMO_SUBSCRIPTION_KEY!,
        },
        cache: 'no-store',
      },
    )

    if (!response.ok) return null

    const data = (await response.json()) as { status?: string }
    return mapStatus(data.status)
  },
}
