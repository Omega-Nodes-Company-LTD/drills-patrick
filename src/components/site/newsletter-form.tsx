'use client'

import { Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { subscribeNewsletter } from '@/app/actions/public'
import type { Locale } from '@/i18n/config'
import { Input } from '@/components/ui/field'
import type { ActionResult } from '@/lib/validation/public'

export function NewsletterForm({ locale }: { locale: Locale }) {
  const t = useTranslations('newsletter')
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    subscribeNewsletter,
    null,
  )

  if (state?.ok) {
    return <p className="text-sm text-success">{t('success')}</p>
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot — hidden from users, filled in by naive bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          required
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="h-11 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
          aria-label={t('submit')}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-danger">
          {state.error === 'already_subscribed' ? t('alreadySubscribed') : t('error')}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('privacy')}</p>
      )}
    </form>
  )
}
