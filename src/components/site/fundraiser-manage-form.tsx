'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { closeFundraiser, editFundraiser } from '@/app/actions/giving'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import type { ActionResult } from '@/lib/validation/public'

/** The owner's own controls, reached from the link in their email. */
export function FundraiserManageForm({
  slug,
  token,
  initial,
}: {
  slug: string
  token: string
  initial: { title: string; story: string; goalAmount: string; endsOn: string; status: string }
}) {
  const t = useTranslations('fundraisers')
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    editFundraiser,
    null,
  )
  const [closeState, closeAction, closing] = useActionState<ActionResult | null, FormData>(
    closeFundraiser,
    null,
  )

  const closed = initial.status === 'closed' || closeState?.ok

  return (
    <div className="flex flex-col gap-8">
      {initial.status === 'pending' ? (
        <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/8 p-4 text-sm">
          {t('pendingReview')}
        </p>
      ) : null}
      {initial.status === 'rejected' ? (
        <p className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/8 p-4 text-sm">
          {t('rejected')}
        </p>
      ) : null}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="token" value={token} />

        <Field label={t('pageTitle')} htmlFor="title" required>
          <Input id="title" name="title" defaultValue={initial.title} required minLength={4} />
        </Field>

        <Field label={t('story')} htmlFor="story">
          <Textarea id="story" name="story" rows={8} defaultValue={initial.story} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('goal')} htmlFor="goalAmount">
            <Input
              id="goalAmount"
              name="goalAmount"
              inputMode="decimal"
              defaultValue={initial.goalAmount}
            />
          </Field>
          <Field label={t('endsOn')} htmlFor="endsOn">
            <Input id="endsOn" name="endsOn" type="date" defaultValue={initial.endsOn} />
          </Field>
        </div>

        {state?.ok ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            {t('saved')}
          </p>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-danger">
            {t('failed')}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || closed}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t('save')}
        </Button>
      </form>

      {!closed ? (
        <form action={closeAction} className="border-t border-border pt-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="token" value={token} />
          <p className="mb-3 text-sm text-muted-foreground">{t('closeHint')}</p>
          <Button type="submit" variant="outline" disabled={closing}>
            {closing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('close')}
          </Button>
        </form>
      ) : (
        <p className="border-t border-border pt-6 text-sm text-muted-foreground">{t('closed')}</p>
      )}
    </div>
  )
}
