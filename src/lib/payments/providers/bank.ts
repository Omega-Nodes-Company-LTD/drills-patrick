import type { CheckoutInput, CheckoutResult, PaymentProvider } from '../types'
import { getSiteSettings } from '@/lib/settings/service'
import { sendBankTransferInstructions } from '@/lib/mail/notifications'
import { sanitizeHtml } from '@/lib/sanitize'
import { pickI18n } from '@/i18n/config'

/**
 * Bank transfer is always available: it needs no credentials, only the account
 * details entered under Settings. The donation stays `pending` until an
 * administrator confirms the incoming transfer.
 */
export const bankProvider: PaymentProvider = {
  id: 'bank',

  isConfigured() {
    return true
  },

  async createCheckout({ donation, locale }: CheckoutInput): Promise<CheckoutResult> {
    const settings = await getSiteSettings()
    const instructions = sanitizeHtml(pickI18n(settings.bankTransfer.instructions, locale))

    // Best effort: the donation is recorded even if the mail server is absent.
    await sendBankTransferInstructions(donation, instructions)

    return { kind: 'instructions' }
  },
}
