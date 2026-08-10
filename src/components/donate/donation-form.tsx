'use client'

import { Building2, CreditCard, Landmark, Loader2, Smartphone, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { startDonation } from '@/app/actions/donate'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'
import { useRouter } from '@/i18n/navigation'
import { currencySymbol, formatMoney, toMinorUnits } from '@/lib/money'
import type { ProviderDescriptor, ProviderId } from '@/lib/payments/types'
import type { DonationStartResult } from '@/lib/validation/donate'
import { cn } from '@/lib/utils'

const providerIcons: Record<ProviderId, typeof CreditCard> = {
  stripe: CreditCard,
  paypal: Wallet,
  pesapal: Building2,
  mtn: Smartphone,
  airtel: Smartphone,
  bank: Landmark,
}

export function DonationForm({
  locale,
  providers,
  currencies,
  defaultCurrency,
  suggestedAmounts,
  minAmounts,
  campaignId,
  campaignTitle,
  projectId,
}: {
  locale: Locale
  providers: ProviderDescriptor[]
  currencies: string[]
  defaultCurrency: string
  suggestedAmounts: number[]
  minAmounts: Record<string, number>
  campaignId?: string | null
  campaignTitle?: string | null
  projectId?: string | null
}) {
  const t = useTranslations('donate')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [currency, setCurrency] = useState(defaultCurrency)
  const [amount, setAmount] = useState<string>(String(suggestedAmounts[1] ?? suggestedAmounts[0] ?? ''))
  const [provider, setProvider] = useState<ProviderId | null>(null)
  const [state, action, pending] = useActionState<DonationStartResult | null, FormData>(
    startDonation,
    null,
  )

  // Only providers that settle in the selected currency stay selectable.
  const available = useMemo(
    () => providers.filter((entry) => !entry.currencies || entry.currencies.includes(currency)),
    [providers, currency],
  )

  useEffect(() => {
    if (available.length === 0) {
      setProvider(null)
      return
    }
    if (!provider || !available.some((entry) => entry.id === provider)) {
      setProvider(available[0]!.id)
    }
  }, [available, provider])

  useEffect(() => {
    if (state?.ok && state.kind === 'redirect') {
      window.location.href = state.url
    }
    if (state?.ok && (state.kind === 'pending' || state.kind === 'instructions')) {
      router.push(`/donate/status?ref=${encodeURIComponent(state.reference)}`)
    }
  }, [state, router])

  const selected = available.find((entry) => entry.id === provider)
  const numericAmount = Number(amount.replace(',', '.'))
  const minimum = minAmounts[currency]
  const isValidAmount = Number.isFinite(numericAmount) && numericAmount > 0
  const belowMinimum = isValidAmount && minimum != null && numericAmount < minimum

  const submitLabel =
    isValidAmount && !belowMinimum
      ? t('submit', {
          amount: formatMoney(toMinorUnits(numericAmount, currency), currency, locale, {
            hideDecimals: Number.isInteger(numericAmount),
          }),
        })
      : t('title')

  if (available.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-border bg-muted p-5 text-sm">
        {t('noMethods')}
      </p>
    )
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-6 rounded-[var(--radius-xl)] border border-border bg-surface p-5 text-surface-foreground md:p-7"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="campaignId" value={campaignId ?? ''} />
      <input type="hidden" name="projectId" value={projectId ?? ''} />
      <input type="hidden" name="provider" value={provider ?? ''} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {campaignTitle ? (
        <p className="text-sm text-muted-foreground">
          {t('backToCampaign')}: <span className="font-medium text-foreground">{campaignTitle}</span>
        </p>
      ) : null}

      {/* ---------------------------------------------------------- amount */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t('chooseAmount')}</legend>

        {suggestedAmounts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {suggestedAmounts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={cn(
                  'rounded-[var(--radius-md)] border px-3 py-3 text-base font-semibold transition-colors',
                  Number(amount) === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:border-primary',
                )}
              >
                {formatMoney(toMinorUnits(value, currency), currency, locale, { hideDecimals: true })}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              {currencySymbol(currency, locale)}
            </span>
            <Input
              name="amount"
              inputMode="decimal"
              required
              aria-label={t('customAmount')}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            aria-label={t('currency')}
            className="w-28"
          >
            {currencies.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </Select>
        </div>

        {belowMinimum ? (
          <p className="text-sm text-danger">
            {t('minAmount', {
              amount: formatMoney(toMinorUnits(minimum!, currency), currency, locale, {
                hideDecimals: true,
              }),
            })}
          </p>
        ) : null}
      </fieldset>

      {/* --------------------------------------------------------- method */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t('paymentMethod')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((entry) => {
            const Icon = providerIcons[entry.id]
            const active = provider === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setProvider(entry.id)}
                aria-pressed={active}
                className={cn(
                  'flex items-start gap-3 rounded-[var(--radius-md)] border p-3 text-start transition-colors',
                  active ? 'border-primary bg-primary/8' : 'border-border hover:border-primary',
                )}
              >
                <Icon className={cn('mt-0.5 size-5 shrink-0', active && 'text-primary')} aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`methods.${entry.id}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`methodHints.${entry.id}`)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* ---------------------------------------------------------- donor */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">{t('yourDetails')}</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('name')} htmlFor="donorName">
            <Input id="donorName" name="donorName" autoComplete="name" />
          </Field>
          <Field label={t('email')} htmlFor="donorEmail">
            <Input id="donorEmail" name="donorEmail" type="email" autoComplete="email" />
          </Field>
          <Field
            label={t('phone')}
            htmlFor="donorPhone"
            required={selected?.requiresPhone}
            hint={selected?.requiresPhone ? t(`methodHints.${selected.id}`) : undefined}
            className={selected?.requiresPhone ? 'sm:col-span-2' : undefined}
          >
            <Input
              id="donorPhone"
              name="donorPhone"
              type="tel"
              autoComplete="tel"
              required={selected?.requiresPhone}
              placeholder="+256…"
            />
          </Field>
          {!selected?.requiresPhone ? (
            <Field label={t('organisation')} htmlFor="donorOrganisation">
              <Input id="donorOrganisation" name="donorOrganisation" autoComplete="organization" />
            </Field>
          ) : null}
        </div>

        <Field label={t('message')} htmlFor="message">
          <Textarea id="message" name="message" rows={3} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isAnonymous"
            value="true"
            className="size-4 rounded border-border accent-[var(--color-primary)]"
          />
          {t('anonymous')}
        </label>
      </fieldset>

      {state && !state.ok ? (
        <p className="text-sm text-danger">
          {state.error === 'below_minimum'
            ? t('minAmount', {
                amount: formatMoney(
                  toMinorUnits(Number(state.fieldErrors?.amount ?? 0), currency),
                  currency,
                  locale,
                  { hideDecimals: true },
                ),
              })
            : state.error === 'invalid'
              ? t('invalidAmount')
              : tCommon('error.generic')}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending || !isValidAmount || belowMinimum}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? t('processing') : submitLabel}
      </Button>
    </form>
  )
}
