import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DonationStatusPanel } from '@/components/donate/donation-status-panel'
import { pickI18n, type Locale } from '@/i18n/config'
import { applyDonationStatus, getDonationByReference } from '@/lib/payments/donations'
import { getConfiguredProvider } from '@/lib/payments/registry'
import { getSiteSettings } from '@/lib/settings/service'
import { sanitizeHtml } from '@/lib/sanitize'

/** Never cached: it reflects the live state of a single donation. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function DonationStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string; cancelled?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const { ref, cancelled } = await searchParams
  if (!ref) notFound()

  const donation = await getDonationByReference(ref)
  if (!donation) notFound()

  const t = await getTranslations('donate')
  const settings = await getSiteSettings()

  // Providers that redirect the donor back here are checked immediately, so a
  // successful payment is reflected without waiting for the webhook.
  //
  // The state is only ever changed on the provider's word. `cancelled=1` comes
  // from a URL the visitor controls, so it is treated as a display hint and
  // never written: otherwise anyone holding a reference — it appears in emails
  // and on bank transfers — could cancel someone else's donation with a GET,
  // and a link prefetch would be enough to trigger it.
  let current = donation

  if (donation.status === 'pending' || donation.status === 'processing') {
    const provider = getConfiguredProvider(donation.provider as never)
    if (provider?.verifyStatus) {
      try {
        const status = await provider.verifyStatus(donation)
        if (status && status !== donation.status) {
          current = (await applyDonationStatus(donation.id, { status })) ?? donation
        }
      } catch (error) {
        console.error('[donate:status] verification failed:', error)
      }
    }
  }

  // Donations abandoned at the provider are closed by the reconciliation job.
  const abandonedByDonor =
    cancelled === '1' && (current.status === 'pending' || current.status === 'processing')

  return (
    <div className="container-narrow py-14 md:py-20">
      <DonationStatusPanel
        reference={current.reference}
        status={current.status}
        abandonedByDonor={abandonedByDonor}
        provider={current.provider}
        amountMinor={current.amountMinor}
        currency={current.currency}
        locale={locale}
        thankYouHtml={sanitizeHtml(pickI18n(settings.donations.thankYouMessage, locale))}
        bankInstructionsHtml={sanitizeHtml(pickI18n(settings.bankTransfer.instructions, locale))}
        bank={{
          accountName: settings.bankTransfer.accountName ?? null,
          bankName: settings.bankTransfer.bankName ?? null,
          accountNumber: settings.bankTransfer.accountNumber ?? null,
          iban: settings.bankTransfer.iban ?? null,
          swift: settings.bankTransfer.swift ?? null,
        }}
        labels={{
          successTitle: t('success.title'),
          successText: t('success.text'),
          pendingTitle: t('pending.title'),
          pendingText: t('pending.text'),
          failedTitle: t('failed.title'),
          failedText: t('failed.text'),
          retry: t('failed.retry'),
          reference: t('success.reference'),
          bankInstructions: t('bankInstructions'),
          bankReference: t('bankReference'),
          mobilePrompt: t('mobileMoneyPrompt'),
          check: t('pending.check'),
        }}
      />
    </div>
  )
}
