'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { startFundraiser } from '@/app/actions/giving'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Where a supporter starts a page of their own.
 *
 * The cause is optional: someone who wants to raise money for "clean water"
 * without picking a specific borehole is still worth having, and forcing the
 * choice at the moment of enthusiasm loses people.
 */
export function FundraiserStartForm({
  locale,
  currencies,
  defaultCurrency,
  campaigns,
  projects,
}: {
  locale: string
  currencies: string[]
  defaultCurrency: string
  campaigns: { id: string; title: string }[]
  projects: { id: string; title: string }[]
}) {
  const t = useTranslations('fundraisers')
  const [state, action, pending] = useActionState<ActionResult<{ slug: string }> | null, FormData>(
    startFundraiser,
    null,
  )

  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-success/40 bg-success/8 p-6">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 className="text-heading">{t('startedTitle')}</h2>
        <p className="text-muted-foreground">{t('startedText')}</p>
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

      <Field label={t('pageTitle')} htmlFor="title" required>
        <Input id="title" name="title" required minLength={4} maxLength={160} />
      </Field>

      <Field label={t('story')} htmlFor="story" hint={t('storyHint')}>
        <Textarea id="story" name="story" rows={6} maxLength={8000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('yourName')} htmlFor="ownerName" required>
          <Input id="ownerName" name="ownerName" autoComplete="name" required />
        </Field>
        <Field label={t('yourEmail')} htmlFor="ownerEmail" hint={t('emailHint')} required>
          <Input id="ownerEmail" name="ownerEmail" type="email" autoComplete="email" required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('goal')} htmlFor="goalAmount" className="sm:col-span-2">
          <Input id="goalAmount" name="goalAmount" inputMode="decimal" defaultValue="0" />
        </Field>
        <Field label={t('currency')} htmlFor="currency">
          <Select id="currency" name="currency" defaultValue={defaultCurrency}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {campaigns.length > 0 ? (
        <Field label={t('campaign')} htmlFor="campaignId" hint={t('causeHint')}>
          <Select id="campaignId" name="campaignId" defaultValue="">
            <option value="">—</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {projects.length > 0 ? (
        <Field label={t('project')} htmlFor="projectId" hint={t('causeHint')}>
          <Select id="projectId" name="projectId" defaultValue="">
            <option value="">—</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label={t('endsOn')} htmlFor="endsOn" hint={t('optional')}>
        <Input id="endsOn" name="endsOn" type="date" />
      </Field>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === 'rate_limited'
            ? t('tooMany')
            : state.error === 'disabled'
              ? t('disabled')
              : t('failed')}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('startSubmit')}
      </Button>
    </form>
  )
}
