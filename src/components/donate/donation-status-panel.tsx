'use client'

import { AlertCircle, CheckCircle2, Clock, Landmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'

type Status = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'

/**
 * Shows the outcome of a donation. While the payment is still open the panel
 * polls the status endpoint, which is what makes mobile-money donations resolve
 * without the donor refreshing anything.
 */
export function DonationStatusPanel({
  reference,
  status: initialStatus,
  provider,
  amountMinor,
  currency,
  locale,
  thankYouHtml,
  bankInstructionsHtml,
  bank,
  labels,
}: {
  reference: string
  status: Status
  provider: string
  amountMinor: number
  currency: string
  locale: Locale
  thankYouHtml: string
  bankInstructionsHtml: string
  bank: {
    accountName: string | null
    bankName: string | null
    accountNumber: string | null
    iban: string | null
    swift: string | null
  }
  labels: Record<string, string>
}) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const isOpen = status === 'pending' || status === 'processing'
  const isBank = provider === 'bank'

  useEffect(() => {
    if (!isOpen || isBank) return

    let attempts = 0
    const timer = setInterval(async () => {
      attempts += 1
      // Give up after five minutes; the reconciliation job takes over.
      if (attempts > 75) {
        clearInterval(timer)
        return
      }

      try {
        const response = await fetch(
          `/api/donations/status?ref=${encodeURIComponent(reference)}`,
          { cache: 'no-store' },
        )
        if (!response.ok) return
        const data = (await response.json()) as { status: Status }
        if (data.status !== status) setStatus(data.status)
      } catch {
        // Transient network errors are ignored; the next tick retries.
      }
    }, 4000)

    return () => clearInterval(timer)
  }, [isOpen, isBank, reference, status])

  const amount = formatMoney(amountMinor, currency, locale)

  if (status === 'succeeded') {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-xl)] border border-success/40 bg-success/8 p-8">
        <CheckCircle2 className="size-9 text-success" aria-hidden />
        <h1 className="text-title">{labels.successTitle}</h1>
        <p className="text-muted-foreground">{labels.successText}</p>
        <p className="text-sm">
          <span className="text-muted-foreground">{labels.reference}: </span>
          <code className="font-medium">{reference}</code> · {amount}
        </p>
        {thankYouHtml ? (
          <div className="prose-content" dangerouslySetInnerHTML={{ __html: thankYouHtml }} />
        ) : null}
        <Button asChild className="mt-2">
          <Link href="/projects">→</Link>
        </Button>
      </div>
    )
  }

  if (status === 'failed' || status === 'cancelled') {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-xl)] border border-danger/40 bg-danger/8 p-8">
        <AlertCircle className="size-9 text-danger" aria-hidden />
        <h1 className="text-title">{labels.failedTitle}</h1>
        <p className="text-muted-foreground">{labels.failedText}</p>
        <Button asChild className="mt-2">
          <Link href="/donate">{labels.retry}</Link>
        </Button>
      </div>
    )
  }

  if (isBank) {
    const details = [
      ['Account', bank.accountName],
      ['Bank', bank.bankName],
      ['Account no.', bank.accountNumber],
      ['IBAN', bank.iban],
      ['SWIFT', bank.swift],
    ].filter(([, value]) => Boolean(value))

    return (
      <div className="flex flex-col gap-5 rounded-[var(--radius-xl)] border border-border bg-surface p-8 text-surface-foreground">
        <Landmark className="size-9 text-primary" aria-hidden />
        <h1 className="text-title">{labels.bankInstructions}</h1>

        <div className="rounded-[var(--radius-md)] border border-dashed border-primary/50 bg-primary/6 p-4">
          <p className="text-sm text-muted-foreground">{labels.bankReference}</p>
          <p className="mt-1 font-heading text-heading font-bold">{reference}</p>
          <p className="mt-1 text-sm">{amount}</p>
        </div>

        {details.length > 0 ? (
          <dl className="flex flex-col gap-2 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-end font-medium break-all">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {bankInstructionsHtml ? (
          <div
            className="prose-content max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: bankInstructionsHtml }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-8 text-surface-foreground">
      <Clock className="size-9 animate-pulse text-warning" aria-hidden />
      <h1 className="text-title">{labels.pendingTitle}</h1>
      <p className="text-muted-foreground">
        {provider === 'mtn' || provider === 'airtel' ? labels.mobilePrompt : labels.pendingText}
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">{labels.reference}: </span>
        <code className="font-medium">{reference}</code> · {amount}
      </p>
    </div>
  )
}
