'use client'

import { Loader2, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteMaintenanceVisit, saveMaintenanceVisit } from '@/app/actions/admin/faults'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'

/**
 * What was actually done at a water point, and whether it worked afterwards.
 *
 * The `functionalAfter` flag is the one field the service figures depend on:
 * the last time someone stood at the well is the only honest answer to "is it
 * working", and a visit record with no verdict is a visit nobody can count.
 */

const KINDS = ['scheduled', 'repair', 'inspection', 'training'] as const

export type VisitRow = {
  id: string
  kind: (typeof KINDS)[number]
  visitedOn: string
  technician: string | null
  findings: string | null
  workDone: string | null
  partsUsed: string | null
  functionalAfter: boolean
}

type Draft = Omit<VisitRow, 'id'> & { id?: string }

const emptyDraft = (): Draft => ({
  kind: 'scheduled',
  visitedOn: new Date().toISOString().slice(0, 10),
  technician: null,
  findings: null,
  workDone: null,
  partsUsed: null,
  functionalAfter: true,
})

export function MaintenanceVisitsEditor({
  projectId,
  rows,
}: {
  projectId: string
  rows: VisitRow[]
}) {
  const t = useTranslations('admin.common')
  const tVisits = useTranslations('admin.visits')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(row: VisitRow) {
    if (!window.confirm(`${t('confirmDelete')} ${t('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteMaintenanceVisit(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Wrench className="size-5 text-primary" aria-hidden />
          {tVisits('title')}
        </h2>
        <Button type="button" size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-4" aria-hidden />
          {t('newItem')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('noItems')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{tVisits(`kinds.${row.kind}`)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.visitedOn}
                  {row.technician ? ` · ${row.technician}` : ''}
                </p>
              </div>

              <Badge variant={row.functionalAfter ? 'success' : 'danger'}>
                {row.functionalAfter ? tVisits('working') : tVisits('notWorking')}
              </Badge>

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

      {draft ? <VisitDialog projectId={projectId} draft={draft} setDraft={setDraft} /> : null}
    </section>
  )
}

function VisitDialog({
  projectId,
  draft,
  setDraft,
}: {
  projectId: string
  draft: Draft
  setDraft: (draft: Draft | null) => void
}) {
  const t = useTranslations('admin.common')
  const tVisits = useTranslations('admin.visits')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveMaintenanceVisit({ ...draft, projectId })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  return (
    <Dialog open onOpenChange={(value) => !value && setDraft(null)}>
      <DialogContent closeLabel={tCommon('close')}>
        <DialogHeader>
          <DialogTitle>{draft.id ? tCommon('edit') : t('newItem')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tVisits('kind')} htmlFor="visit-kind">
              <Select
                id="visit-kind"
                value={draft.kind}
                onChange={(event) =>
                  setDraft({ ...draft, kind: event.target.value as VisitRow['kind'] })
                }
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {tVisits(`kinds.${kind}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('date')} htmlFor="visit-date" required>
              <Input
                id="visit-date"
                type="date"
                value={draft.visitedOn}
                onChange={(event) => setDraft({ ...draft, visitedOn: event.target.value })}
              />
            </Field>
          </div>

          <Field label={tVisits('technician')} htmlFor="visit-tech">
            <Input
              id="visit-tech"
              value={draft.technician ?? ''}
              onChange={(event) => setDraft({ ...draft, technician: event.target.value })}
            />
          </Field>

          <Field label={tVisits('findings')} htmlFor="visit-findings">
            <Textarea
              id="visit-findings"
              rows={2}
              value={draft.findings ?? ''}
              onChange={(event) => setDraft({ ...draft, findings: event.target.value })}
            />
          </Field>

          <Field label={tVisits('workDone')} htmlFor="visit-work">
            <Textarea
              id="visit-work"
              rows={2}
              value={draft.workDone ?? ''}
              onChange={(event) => setDraft({ ...draft, workDone: event.target.value })}
            />
          </Field>

          <Field label={tVisits('parts')} htmlFor="visit-parts">
            <Input
              id="visit-parts"
              value={draft.partsUsed ?? ''}
              onChange={(event) => setDraft({ ...draft, partsUsed: event.target.value })}
            />
          </Field>

          <label className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-border p-3">
            <span>
              <span className="text-sm font-medium">{tVisits('functionalAfter')}</span>
              <span className="block text-xs text-muted-foreground">
                {tVisits('functionalHint')}
              </span>
            </span>
            <Switch
              checked={draft.functionalAfter}
              onCheckedChange={(functionalAfter) => setDraft({ ...draft, functionalAfter })}
            />
          </label>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
