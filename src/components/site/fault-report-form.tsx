'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { reportFault } from '@/app/actions/public'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import type { ActionResult } from '@/lib/validation/public'

/**
 * The form behind the QR sticker on a well cover.
 *
 * Deliberately short. It is filled in standing next to a broken pump, often
 * on a shared phone with a bad signal, by someone who has no reason to create
 * an account. Name and phone are optional: a report with neither is still
 * worth having.
 */

const SYMPTOMS = ['no_water', 'low_yield', 'broken_handle', 'dirty_water', 'other'] as const

export function FaultReportForm({ projectId }: { projectId: string }) {
  const t = useTranslations('report')
  const [state, action, pending] = useActionState<ActionResult<{ reference: string }> | null, FormData>(
    reportFault,
    null,
  )

  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success/8 p-6">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 className="text-heading">{t('thanksTitle')}</h2>
        <p className="text-muted-foreground">{t('thanksText')}</p>
        {state.data?.reference ? (
          <p className="text-small">
            {t('reference')}: <code className="font-semibold">{state.data.reference}</code>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      {/* Honeypot: a real person never fills this in. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <Field label={t('symptom')} htmlFor="symptom">
        <Select id="symptom" name="symptom" defaultValue="no_water">
          {SYMPTOMS.map((symptom) => (
            <option key={symptom} value={symptom}>
              {t(`symptoms.${symptom}`)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('description')} htmlFor="description" required>
        <Textarea id="description" name="description" rows={4} required minLength={5} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('yourName')} htmlFor="reporterName" hint={t('optional')}>
          <Input id="reporterName" name="reporterName" autoComplete="name" />
        </Field>
        <Field label={t('yourPhone')} htmlFor="reporterPhone" hint={t('optional')}>
          <Input id="reporterPhone" name="reporterPhone" type="tel" inputMode="tel" />
        </Field>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === 'rate_limited' ? t('tooMany') : t('failed')}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('submit')}
      </Button>
    </form>
  )
}
