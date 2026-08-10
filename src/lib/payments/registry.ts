import 'server-only'
import type { PaymentProvider, ProviderDescriptor, ProviderId } from './types'
import { airtelProvider } from './providers/airtel'
import { bankProvider } from './providers/bank'
import { mtnProvider } from './providers/mtn'
import { paypalProvider } from './providers/paypal'
import { pesapalProvider } from './providers/pesapal'
import { stripeProvider } from './providers/stripe'

/**
 * Every payment provider is optional and self-declaring: a provider that is
 * missing its environment variables reports `isConfigured() === false` and is
 * simply not offered. Bank transfer always remains, so the donation form is
 * never empty.
 *
 * Ordering here is the order shown in the form.
 */
const providers: PaymentProvider[] = [
  stripeProvider,
  pesapalProvider,
  mtnProvider,
  airtelProvider,
  paypalProvider,
  bankProvider,
]

export function getProvider(id: ProviderId): PaymentProvider | null {
  return providers.find((provider) => provider.id === id) ?? null
}

export function getConfiguredProvider(id: ProviderId): PaymentProvider | null {
  const provider = getProvider(id)
  return provider && provider.isConfigured() ? provider : null
}

/** Descriptors for the client — no secrets, just what the UI needs. */
export async function listAvailableProviders(): Promise<ProviderDescriptor[]> {
  return providers
    .filter((provider) => provider.isConfigured())
    .map((provider) => ({
      id: provider.id,
      currencies: provider.currencies ?? null,
      requiresPhone: provider.requiresPhone ?? false,
    }))
}

/** Used by the admin integrations panel. */
export function providerStatuses(): { id: ProviderId; configured: boolean }[] {
  return providers.map((provider) => ({ id: provider.id, configured: provider.isConfigured() }))
}

export function providersSupporting(currency: string): ProviderId[] {
  return providers
    .filter(
      (provider) =>
        provider.isConfigured() &&
        (!provider.currencies || provider.currencies.includes(currency.toUpperCase())),
    )
    .map((provider) => provider.id)
}
