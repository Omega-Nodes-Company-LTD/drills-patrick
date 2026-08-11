'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { submitLegacyEnquiry } from '@/app/actions/giving'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import type { ActionResult } from '@/lib/validation/public'

const KINDS = ['legacy', 'major_gift', 'foundation', 'in_memory'] as const

/**
 * The way in for a gift that needs a conversation.
 *
 * No amount field anywhere. Someone writing about their will is not filling
 * in a payment form, and asking them to name a figure at this stage is the
 * fastest way to end the conversation before it starts.
 */
export function LegacyForm({ locale }: { locale: string }) {
  const t = useTranslations('legacy')
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    submitLegacyEnquiry,
    null,
  )

  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success/8 p-6">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 className="text-heading">{t('thanksTitle')}</h2>
        <p className="text-muted-foreground">{t('thanksText')}</p>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <Field label={t('kind')} htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="legacy">
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('name')} htmlFor="name" required>
          <Input id="name" name="name" autoComplete="name" required minLength={2} />
        </Field>
        <Field label={t('email')} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t('phone')} htmlFor="phone" hint={t('optional')}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label={t('country')} htmlFor="country" hint={t('optional')}>
          <Input id="country" name="country" autoComplete="country-name" />
        </Field>
      </div>

      <Field label={t('organisation')} htmlFor="organisation" hint={t('optional')}>
        <Input id="organisation" name="organisation" autoComplete="organization" />
      </Field>

      <Field
        label={t('preferredContact')}
        htmlFor="preferredContact"
        hint={t('preferredContactHint')}
      >
        <Input id="preferredContact" name="preferredContact" maxLength={200} />
      </Field>

      <Field label={t('message')} htmlFor="message">
        <Textarea id="message" name="message" rows={5} maxLength={5000} />
      </Field>

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
