'use client'

import { Check, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { moderateFundraiser } from '@/app/actions/admin/giving'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Textarea } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'

export type ModerationRow = {
  id: string
  slug: string
  title: string
  ownerName: string
  ownerEmail: string
  story: string
  status: string
  moderationNote: string | null
  raisedAmountMinor: number
  goalAmountMinor: number
  currency: string
  createdAt: string
}

/**
 * Approving, rejecting and closing supporter pages.
 *
 * The whole story is shown inline rather than behind a link: the point of the
 * review is to read what will appear under the organisation's name, and a
 * screen that makes that an extra click turns into rubber-stamping.
 */
export function FundraiserModeration({
  rows,
  locale,
}: {
  rows: ModerationRow[]
  locale: Locale
}) {
  const t = useTranslations('admin.fundraisers')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function apply(id: string, status: ModerationRow['status'], moderationNote?: string) {
    startTransition(async () => {
      const result = await moderateFundraiser({ id, status, moderationNote })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setRejecting(null)
        setNote('')
      } else {
        toast.error(result.error === 'reason_required' ? t('reasonRequired') : tCommon('error.generic'))
      }
    })
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{tAdmin('noItems')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Card key={row.id}>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{row.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('owner')} {row.ownerName} · {row.ownerEmail}
              </p>
            </div>
            <Badge variant={row.status === 'approved' ? 'default' : 'outline'}>
              {t(row.status)}
            </Badge>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {row.story ? (
              <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-muted/40 p-3 text-sm">
                {row.story}
              </p>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {t('raised')}: {formatMoney(row.raisedAmountMinor, row.currency, locale)}
              {row.goalAmountMinor > 0
                ? ` · ${t('goal')}: ${formatMoney(row.goalAmountMinor, row.currency, locale)}`
                : ''}
            </p>

            {row.moderationNote ? (
              <p className="text-sm text-muted-foreground">{row.moderationNote}</p>
            ) : null}

            {rejecting === row.id ? (
              <div className="flex flex-col gap-3">
                <Field label={t('note')} htmlFor={`note-${row.id}`}>
                  <Textarea
                    id={`note-${row.id}`}
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => apply(row.id, 'rejected', note)}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {t('reject')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                    {tCommon('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {row.status !== 'approved' ? (
                  <Button size="sm" disabled={pending} onClick={() => apply(row.id, 'approved')}>
                    <Check className="size-4" aria-hidden />
                    {t('approve')}
                  </Button>
                ) : null}
                {row.status !== 'rejected' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejecting(row.id)
                      setNote(row.moderationNote ?? '')
                    }}
                  >
                    <X className="size-4" aria-hidden />
                    {t('reject')}
                  </Button>
                ) : null}
                {row.status !== 'closed' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => apply(row.id, 'closed')}
                  >
                    {t('close')}
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
