'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateLegacyEnquiry } from '@/app/actions/admin/giving'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Select, Textarea } from '@/components/ui/field'

export type LegacyRow = {
  id: string
  kind: string
  name: string
  email: string
  phone: string | null
  country: string | null
  organisation: string | null
  preferredContact: string | null
  message: string
  status: string
  adminNote: string | null
  createdAt: string
}

const STATUSES = ['new', 'in_conversation', 'closed'] as const

/**
 * Enquiries about legacies and large gifts.
 *
 * Kept apart from ordinary contact messages because the reply time that
 * matters here is days, not weeks, and a row sitting in the same list as a
 * spelling correction does not get one.
 */
export function LegacyEnquiryList({ rows }: { rows: LegacyRow[] }) {
  const t = useTranslations('admin.legacies')
  const tLegacy = useTranslations('legacy')
  const tCommon = useTranslations('common')
  const [editing, setEditing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string>('new')
  const [pending, startTransition] = useTransition()

  function save(id: string) {
    startTransition(async () => {
      const result = await updateLegacyEnquiry({ id, status, adminNote: note })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setEditing(null)
      } else toast.error(tCommon('error.generic'))
    })
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Card key={row.id}>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{row.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                <a href={`mailto:${row.email}`} className="underline">
                  {row.email}
                </a>
                {row.phone ? ` · ${row.phone}` : ''}
                {row.organisation ? ` · ${row.organisation}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{tLegacy(`kinds.${row.kind}`)}</Badge>
              <Badge variant={row.status === 'new' ? 'default' : 'outline'}>{t(row.status)}</Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            {row.preferredContact ? (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('preferredContact')}:</span>{' '}
                {row.preferredContact}
              </p>
            ) : null}

            {row.message ? (
              <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-muted/40 p-3 text-sm">
                {row.message}
              </p>
            ) : null}

            {row.adminNote && editing !== row.id ? (
              <p className="text-sm text-muted-foreground">{row.adminNote}</p>
            ) : null}

            {editing === row.id ? (
              <div className="flex flex-col gap-3">
                <Field label={t('title')} htmlFor={`status-${row.id}`}>
                  <Select
                    id={`status-${row.id}`}
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('note')} htmlFor={`note-${row.id}`}>
                  <Textarea
                    id={`note-${row.id}`}
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" disabled={pending} onClick={() => save(row.id)}>
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {tCommon('save')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {tCommon('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => {
                  setEditing(row.id)
                  setNote(row.adminNote ?? '')
                  setStatus(row.status)
                }}
              >
                {tCommon('edit')}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
