'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { submitContact } from '@/app/actions/public'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'
import type { ActionResult } from '@/lib/validation/public'

export function ContactForm({ locale }: { locale: Locale }) {
  const t = useTranslations('contact')
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitContact, null)

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
        <Field label={t('name')} htmlFor="name" required error={fieldError('name')}>
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
        <Field label={t('email')} htmlFor="email" required error={fieldError('email')}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label={t('phone')} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label={t('subject')} htmlFor="subject">
          <Input id="subject" name="subject" />
        </Field>
      </div>

      <Field label={t('message')} htmlFor="message" required error={fieldError('message')}>
        <Textarea id="message" name="message" rows={6} required />
      </Field>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-sm text-danger">{t('error')}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="sm:self-start">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('send')}
      </Button>
    </form>
  )
}
