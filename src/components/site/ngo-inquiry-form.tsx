'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { submitNgoInquiry } from '@/app/actions/public'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'
import type { ActionResult } from '@/lib/validation/public'

const INTERVENTIONS = [
  'borehole',
  'shallow_well',
  'spring_protection',
  'rainwater_harvesting',
  'solar_pump',
  'rehabilitation',
  'piped_scheme',
] as const

const TIMEFRAMES = ['urgent', 'sixMonths', 'year', 'exploring'] as const

/** Lead form for NGOs, foundations and district authorities. */
export function NgoInquiryForm({
  locale,
  currencies,
  defaultCurrency,
}: {
  locale: Locale
  currencies: string[]
  defaultCurrency: string
}) {
  const t = useTranslations('contact.ngo')
  const tCommon = useTranslations('common')
  const tTypes = useTranslations('projects.type')
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    submitNgoInquiry,
    null,
  )

  if (state?.ok) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success/10 p-5">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <p className="text-sm">{t('success')}</p>
      </div>
    )
  }

  const fieldError = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organisation')} htmlFor="organisationName" required error={fieldError('organisationName')}>
          <Input id="organisationName" name="organisationName" required autoComplete="organization" />
        </Field>
        <Field label={t('contactName')} htmlFor="contactName" required error={fieldError('contactName')}>
          <Input id="contactName" name="contactName" required autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email" required error={fieldError('email')}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={tCommon('optional')} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+256…" />
        </Field>
        <Field label={t('country')} htmlFor="country">
          <Input id="country" name="country" defaultValue="Uganda" />
        </Field>
        <Field label={t('region')} htmlFor="region">
          <Input id="region" name="region" />
        </Field>
        <Field label={t('interventionType')} htmlFor="interventionType">
          <Select id="interventionType" name="interventionType" defaultValue="borehole">
            {INTERVENTIONS.map((value) => (
              <option key={value} value={value}>
                {tTypes(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('wells')} htmlFor="wellsRequested">
          <Input id="wellsRequested" name="wellsRequested" type="number" min={0} inputMode="numeric" />
        </Field>
        <Field label={t('beneficiaries')} htmlFor="beneficiariesEstimate">
          <Input
            id="beneficiariesEstimate"
            name="beneficiariesEstimate"
            type="number"
            min={0}
            inputMode="numeric"
          />
        </Field>
        <Field label={t('budget')} htmlFor="budget">
          <div className="flex gap-2">
            <Input id="budget" name="budget" type="number" min={0} step="any" inputMode="decimal" />
            <Select name="currency" defaultValue={defaultCurrency} className="w-28" aria-label="currency">
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label={t('timeframe')} htmlFor="timeframe" className="sm:col-span-2">
          <Select id="timeframe" name="timeframe" defaultValue="sixMonths">
            {TIMEFRAMES.map((value) => (
              <option key={value} value={value}>
                {t(`timeframes.${value}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t('message')} htmlFor="message" hint={t('privacy')}>
        <Textarea id="message" name="message" rows={5} />
      </Field>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-sm text-danger">{tCommon('error.generic')}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="sm:self-start">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('submit')}
      </Button>
    </form>
  )
}
