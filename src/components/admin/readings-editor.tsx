'use client'

import { Activity, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteReading, saveReading } from '@/app/actions/admin/transparency'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'

/**
 * Yield and water level measured over the life of a water point.
 *
 * A flat list with an inline form rather than a dialog: readings are entered
 * in batches after a round of visits, and a modal per row would make that
 * needlessly slow.
 */

export type ReadingRow = {
  id: string
  measuredOn: string
  yieldLitersPerHour: number | null
  staticLevelM: number | null
  note: string | null
  measuredBy: string | null
}

type Draft = Omit<ReadingRow, 'id'> & { id?: string }

export function ReadingsEditor({ projectId, rows }: { projectId: string; rows: ReadingRow[] }) {
  const t = useTranslations('admin.readings')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  const empty = (): Draft => ({
    measuredOn: new Date().toISOString().slice(0, 10),
    yieldLitersPerHour: null,
    staticLevelM: null,
    note: null,
    measuredBy: null,
  })

  function save() {
    if (!draft) return

    startTransition(async () => {
      const result = await saveReading({ ...draft, projectId })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  function remove(row: ReadingRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteReading(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Activity className="size-5 text-primary" aria-hidden />
          {t('title')}
        </h2>
        <Button type="button" size="sm" onClick={() => setDraft(empty())}>
          <Plus className="size-4" aria-hidden />
          {tAdmin('newItem')}
        </Button>
      </div>

      <p className="text-small text-muted-foreground">{t('hint')}</p>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {tAdmin('noItems')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3"
            >
              <span className="w-28 shrink-0 tabular-nums">{row.measuredOn}</span>
              <span className="tabular-nums">
                {row.yieldLitersPerHour ? `${row.yieldLitersPerHour} l/h` : '—'}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {row.staticLevelM != null ? `${row.staticLevelM} m` : ''}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {row.note ?? ''}
              </span>

              <Button
                size="iconSm"
                variant="ghost"
                onClick={() => setDraft({ ...row })}
                title={tCommon('edit')}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                size="iconSm"
                variant="ghost"
                onClick={() => remove(row)}
                disabled={pending}
                title={tCommon('delete')}
                className="text-muted-foreground hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={tAdmin('date')} required>
              <Input
                type="date"
                value={draft.measuredOn}
                onChange={(event) => setDraft({ ...draft, measuredOn: event.target.value })}
              />
            </Field>
            <Field label={t('yield')}>
              <Input
                type="number"
                min={0}
                value={draft.yieldLitersPerHour ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    yieldLitersPerHour: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label={t('level')}>
              <Input
                type="number"
                min={0}
                value={draft.staticLevelM ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    staticLevelM: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label={t('measuredBy')}>
              <Input
                value={draft.measuredBy ?? ''}
                onChange={(event) => setDraft({ ...draft, measuredBy: event.target.value })}
              />
            </Field>
          </div>

          <Field label={t('note')}>
            <Textarea
              rows={2}
              value={draft.note ?? ''}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </Field>

          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {tCommon('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
