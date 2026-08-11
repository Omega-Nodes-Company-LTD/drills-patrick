'use client'

import { CheckCircle2, Loader2, Pause, Play, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { manageRecurring } from '@/app/actions/giving'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import type { ActionResult } from '@/lib/validation/public'

/**
 * The donor's own controls.
 *
 * Pause and stop are one click and ask for nothing. A donor who cannot find
 * the pause button cancels instead, and a cancelled gift does not come back —
 * so anything that makes stopping harder costs more than it saves.
 */
export function RecurringManage({
  reference,
  token,
  plan,
}: {
  reference: string
  token: string
  plan: {
    status: string
    amount: string
    currency: string
    interval: string
    nextChargeOn: string | null
    pausedUntil: string | null
    formattedAmount: string
    annualised: string
  }
}) {
  const t = useTranslations('recurring')
  const [state, action, pending] = useActionState<ActionResult<{ status: string }> | null, FormData>(
    manageRecurring,
    null,
  )
  const [confirming, setConfirming] = useState(false)

  const status = state?.ok ? (state.data?.status ?? plan.status) : plan.status
  const cancelled = status === 'cancelled'
  const paused = status === 'paused'

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t('amount')}</dt>
          <dd className="text-subheading font-semibold">{plan.formattedAmount}</dd>
          <dd className="text-sm text-muted-foreground">
            {t('annualised', { amount: plan.annualised })}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interval')}</dt>
          <dd className="font-medium">{t(plan.interval)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('status')}</dt>
          <dd className="font-medium">{t(status)}</dd>
          {paused && plan.pausedUntil ? (
            <dd className="text-sm text-muted-foreground">
              {t('pausedUntil', { date: plan.pausedUntil })}
            </dd>
          ) : null}
        </div>
        {plan.nextChargeOn && !cancelled ? (
          <div>
            <dt className="text-sm text-muted-foreground">{t('nextCharge')}</dt>
            <dd className="font-medium">{plan.nextChargeOn}</dd>
          </div>
        ) : null}
      </dl>

      {state?.ok ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          {t('saved')}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === 'cancelled'
            ? t('alreadyCancelled')
            : state.error === 'below_minimum'
              ? t('belowMinimum', { amount: state.fieldErrors?.amount ?? '' })
              : t('failed')}
        </p>
      ) : null}

      {cancelled ? (
        <p className="text-sm text-muted-foreground">{t('alreadyCancelled')}</p>
      ) : (
        <>
          <form action={action} className="flex flex-col gap-4 border-t border-border pt-6">
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="amount" />

            <Field label={t('changeAmount')} htmlFor="amount">
              <Input id="amount" name="amount" inputMode="decimal" defaultValue={plan.amount} />
            </Field>

            <Button type="submit" disabled={pending} className="self-start">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('save')}
            </Button>
          </form>

          <form action={action} className="flex flex-col gap-4 border-t border-border pt-6">
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value={paused ? 'resume' : 'pause'} />

            {!paused ? (
              <Field label={t('resumeOn')} htmlFor="resumeOn" hint={t('resumeOnHint')}>
                <Input id="resumeOn" name="resumeOn" type="date" />
              </Field>
            ) : null}

            <Button type="submit" variant="outline" disabled={pending} className="self-start">
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              {paused ? t('resume') : t('pause')}
            </Button>
          </form>

          <form action={action} className="flex flex-col gap-4 border-t border-border pt-6">
            <input type="hidden" name="reference" value={reference} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="cancel" />

            {confirming ? (
              <>
                {/* Asked after the decision, never as a condition of it. */}
                <Field label={t('reason')} htmlFor="reason" hint={t('reasonHint')}>
                  <Textarea id="reason" name="reason" rows={3} maxLength={500} />
                </Field>
                <Button type="submit" variant="outline" disabled={pending} className="self-start">
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirming(true)}
                className="self-start text-muted-foreground"
              >
                <X className="size-4" aria-hidden />
                {t('cancel')}
              </Button>
            )}
          </form>
        </>
      )}
    </div>
  )
}
