import Stripe from 'stripe'
import { env, features } from '@/env'
import type {
  CheckoutInput,
  CheckoutResult,
  PaymentProvider,
  WebhookOutcome,
} from '../types'
import type { DonationRow, DonationStatus } from '@/db/schema'

let client: Stripe | null = null

function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured')
  client ??= new Stripe(env.STRIPE_SECRET_KEY)
  return client
}

function mapStatus(session: Stripe.Checkout.Session): DonationStatus {
  if (session.payment_status === 'paid') return 'succeeded'
  if (session.status === 'expired') return 'cancelled'
  return 'processing'
}

export const stripeProvider: PaymentProvider = {
  id: 'stripe',

  isConfigured() {
    return features.stripe
  },

  async createCheckout({
    donation,
    locale,
    returnUrl,
    cancelUrl,
  }: CheckoutInput): Promise<CheckoutResult> {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      // Stripe expects the smallest currency unit, which is how we store amounts.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: donation.currency.toLowerCase(),
            unit_amount: donation.amountMinor,
            product_data: {
              name: donation.campaignId ? 'Donation' : 'General donation',
              description: `Reference ${donation.reference}`,
            },
          },
        },
      ],
      customer_email: donation.donorEmail ?? undefined,
      client_reference_id: donation.reference,
      metadata: { donationReference: donation.reference },
      locale: (['en', 'fr', 'it', 'de'].includes(locale) ? locale : 'auto') as
        | Stripe.Checkout.SessionCreateParams.Locale,
      success_url: returnUrl,
      cancel_url: cancelUrl,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')

    return { kind: 'redirect', url: session.url, providerRef: session.id }
  },

  async verifyStatus(donation: DonationRow): Promise<DonationStatus | null> {
    if (!donation.providerRef) return null
    const session = await stripe().checkout.sessions.retrieve(donation.providerRef)
    return mapStatus(session)
  },

  async handleWebhook(request: Request): Promise<WebhookOutcome | null> {
    const signature = request.headers.get('stripe-signature')
    if (!signature || !env.STRIPE_WEBHOOK_SECRET) return null

    const body = await request.text()
    const event = stripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.expired' &&
      event.type !== 'checkout.session.async_payment_failed' &&
      event.type !== 'checkout.session.async_payment_succeeded'
    ) {
      return null
    }

    const session = event.data.object as Stripe.Checkout.Session

    const status: DonationStatus =
      event.type === 'checkout.session.expired'
        ? 'cancelled'
        : event.type === 'checkout.session.async_payment_failed'
          ? 'failed'
          : mapStatus(session)

    return {
      eventKey: `stripe:${event.id}`,
      eventType: event.type,
      donationRef: session.client_reference_id ?? undefined,
      providerRef: session.id,
      status,
      payload: { id: event.id, type: event.type },
    }
  },
}
