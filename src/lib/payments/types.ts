import type { DonationRow, DonationStatus, PaymentProviderId } from '@/db/schema'
import type { Locale } from '@/i18n/config'

export type ProviderId = Exclude<PaymentProviderId, 'manual'>

export type CheckoutInput = {
  donation: DonationRow
  locale: Locale
  /** Where the provider should send the donor back once it is done. */
  returnUrl: string
  cancelUrl: string
  /** Server-to-server callback, when the provider supports one. */
  notifyUrl: string
}

export type CheckoutResult =
  /** Send the donor to the provider's hosted page. */
  | { kind: 'redirect'; url: string; providerRef?: string }
  /** Payment requested on the donor's phone; we poll for the outcome. */
  | { kind: 'pending'; providerRef?: string; message?: string }
  /** Nothing to do online — bank transfer instructions are shown instead. */
  | { kind: 'instructions'; providerRef?: string }

export type WebhookOutcome = {
  /** Stable key used to make webhook processing idempotent. */
  eventKey: string
  eventType: string
  /** Donation reference or provider reference used to locate the donation. */
  donationRef?: string
  providerRef?: string
  status?: DonationStatus
  feeMinor?: number
  payload?: Record<string, unknown>
}

export interface PaymentProvider {
  readonly id: ProviderId
  /** True when every environment variable this provider needs is present. */
  isConfigured(): boolean
  /** `undefined` means "any currency the site accepts". */
  readonly currencies?: string[]
  /** Mobile money needs a phone number before the request can be sent. */
  readonly requiresPhone?: boolean
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  /** Polls the provider; used by the status page and the reconciliation job. */
  verifyStatus?(donation: DonationRow): Promise<DonationStatus | null>
  handleWebhook?(request: Request): Promise<WebhookOutcome | null>
}

/** Shape sent to the client so the form can render the available choices. */
export type ProviderDescriptor = {
  id: ProviderId
  currencies: string[] | null
  requiresPhone: boolean
}
