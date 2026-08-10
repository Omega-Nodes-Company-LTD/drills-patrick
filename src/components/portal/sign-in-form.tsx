'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect } from 'react'
import { partnerSignIn, type PartnerSignInResult } from '@/app/actions/partner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useRouter } from '@/i18n/navigation'

/** Sign-in for a partner contact. Nothing here can reach the admin session. */
export function PartnerSignInForm() {
  const t = useTranslations('portal')
  const router = useRouter()
  const [state, action, pending] = useActionState<PartnerSignInResult | null, FormData>(
    partnerSignIn,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      router.push('/portal')
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t('email')} htmlFor="partner-email">
        <Input
          id="partner-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          inputMode="email"
        />
      </Field>

      <Field label={t('password')} htmlFor="partner-password">
        <Input
          id="partner-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
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
        {t('signIn')}
      </Button>
    </form>
  )
}
