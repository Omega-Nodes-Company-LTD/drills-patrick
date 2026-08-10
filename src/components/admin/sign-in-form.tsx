'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { signIn, type SignInResult } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'

export function SignInForm({ locale }: { locale: Locale }) {
  const t = useTranslations('admin.signIn')
  const [state, action, pending] = useActionState<SignInResult | null, FormData>(signIn, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <Field label={t('email')} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          inputMode="email"
        />
      </Field>

      <Field label={t('password')} htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === 'inactive'
            ? t('inactive')
            : state.error === 'too_many'
              ? t('tooMany')
              : t('invalid')}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('submit')}
      </Button>
    </form>
  )
}
