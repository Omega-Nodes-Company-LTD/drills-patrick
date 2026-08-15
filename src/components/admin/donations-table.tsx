'use client'

import { Check, Loader2, Mail, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  confirmDonation,
  markDonationFailed,
  recordManualDonation,
  resendReceipt,
} from '@/app/actions/admin/donations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { intlLocale, type Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export type DonationRowView = {
  id: string
  reference: string
  donor: string
  email: string | null
  amountMinor: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'
  provider: string
  campaign: string | null
  createdAt: string
  receiptSent: boolean
}

const statusVariant: Record<DonationRowView['status'], 'success' | 'warning' | 'danger' | 'default'> = {
  succeeded: 'success',
  pending: 'warning',
  processing: 'warning',
  failed: 'danger',
  cancelled: 'danger',
  refunded: 'default',
}

export function DonationsTable({
  rows,
  locale,
  currencies,
  campaigns,
  canExport,
}: {
  rows: DonationRowView[]
  locale: Locale
  currencies: string[]
  campaigns: { id: string; title: string }[]
  canExport: boolean
}) {
  const t = useTranslations('admin.donations')
  const tCommon = useTranslations('common')
  const tAdmin = useTranslations('admin.common')
  const [pending, startTransition] = useTransition()
  const [manualOpen, setManualOpen] = useState(false)

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(success)
      else toast.error(tCommon('error.generic'))
    })
  }

  function exportCsv() {
    const header = ['reference', 'donor', 'email', 'amount', 'currency', 'status', 'provider', 'date']
    const lines = rows.map((row) =>
      [
        row.reference,
        row.donor,
        row.email ?? '',
        (row.amountMinor / 100).toFixed(2),
        row.currency,
        row.status,
        row.provider,
        row.createdAt,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )

    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setManualOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t('recordManual')}
        </Button>
        {canExport && rows.length > 0 ? (
          <Button type="button" variant="outline" onClick={exportCsv}>
            {tAdmin('export')}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className={cn('flex flex-col gap-2', pending && 'opacity-70')}>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 md:flex-row md:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.donor}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.reference} · {row.provider}
                  {row.campaign ? ` · ${row.campaign}` : ''}
                </p>
              </div>

              <span className="shrink-0 font-semibold">
                {formatMoney(row.amountMinor, row.currency, locale)}
              </span>

              <Badge variant={statusVariant[row.status]} className="shrink-0">
                {t(`statuses.${row.status}`)}
              </Badge>

              <span className="shrink-0 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(intlLocale(locale), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(row.createdAt))}
              </span>

              <div className="flex shrink-0 gap-1 pointer-coarse:gap-3">
                {row.status === 'pending' || row.status === 'processing' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => confirmDonation(row.id), tCommon('success.saved'))}
                      title={t('markReceivedHint')}
                    >
                      <Check className="size-4" aria-hidden />
                      <span className="sr-only lg:not-sr-only lg:text-xs">{t('markReceived')}</span>
                    </Button>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(() => markDonationFailed(row.id), tCommon('success.saved'))}
                      title={t('statuses.cancelled')}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </>
                ) : null}

                {row.status === 'succeeded' && row.email ? (
                  <Button
                    size="iconSm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => resendReceipt(row.id), t('receiptSent'))}
                    title={t('sendReceipt')}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Mail className="size-4" aria-hidden />
                    )}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ManualDonationDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        currencies={currencies}
        campaigns={campaigns}
      />
    </div>
  )
}

function ManualDonationDialog({
  open,
  onOpenChange,
  currencies,
  campaigns,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currencies: string[]
  campaigns: { id: string; title: string }[]
}) {
  const t = useTranslations('admin.donations')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon('close')}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const data = Object.fromEntries(new FormData(event.currentTarget))

            startTransition(async () => {
              const result = await recordManualDonation({
                ...data,
                markAsReceived: data.markAsReceived === 'on',
                campaignId: data.campaignId || null,
              })

              if (result.ok) {
                toast.success(tCommon('success.created'))
                onOpenChange(false)
              } else {
                toast.error(tCommon('error.generic'))
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('recordManual')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label={t('amount')} htmlFor="amount" required>
                <Input id="amount" name="amount" inputMode="decimal" required />
              </Field>
              <Field label="Currency" htmlFor="m-currency">
                <Select id="m-currency" name="currency" defaultValue={currencies[0]}>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={t('donor')} htmlFor="donorName">
              <Input id="donorName" name="donorName" />
            </Field>

            <Field label="Email" htmlFor="donorEmail">
              <Input id="donorEmail" name="donorEmail" type="email" />
            </Field>

            <Field label={t('campaign')} htmlFor="m-campaign">
              <Select id="m-campaign" name="campaignId" defaultValue="">
                <option value="">—</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('adminNote')} htmlFor="adminNote">
              <Input id="adminNote" name="adminNote" />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="markAsReceived"
                defaultChecked
                className="size-4 accent-[var(--color-primary)]"
              />
              {t('markReceived')}
            </label>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
