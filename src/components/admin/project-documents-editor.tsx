'use client'

import { FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteProjectDocument, saveProjectDocument } from '@/app/actions/admin/documents'
import { MediaPicker } from '@/components/admin/media/media-picker'
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
 * The documents attached to a project: certificates, logs, handover notes.
 * They are what a partner opens the portal for, and what a donor's auditor
 * asks to see.
 */

const KINDS = [
  'water_quality',
  'drilling_log',
  'handover',
  'commissioning',
  'contract',
  'report',
  'other',
] as const

export type DocumentRow = {
  id: string
  mediaId: string | null
  kind: (typeof KINDS)[number]
  title: string
  description: string | null
  issuedOn: string | null
  expiresOn: string | null
  isPublic: boolean
}

type Draft = Omit<DocumentRow, 'id'> & { id?: string }

const emptyDraft = (): Draft => ({
  mediaId: null,
  kind: 'water_quality',
  title: '',
  description: null,
  issuedOn: null,
  expiresOn: null,
  isPublic: false,
})

export function ProjectDocumentsEditor({
  projectId,
  rows,
  storageEnabled,
}: {
  projectId: string
  rows: DocumentRow[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tDocs = useTranslations('documents')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(row: DocumentRow) {
    if (!window.confirm(`${t('confirmDelete')} ${t('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteProjectDocument(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <FileText className="size-5 text-primary" aria-hidden />
          {tDocs('title')}
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
                <p className="truncate font-medium">{row.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {tDocs(`kinds.${row.kind}`)}
                  {row.issuedOn ? ` · ${row.issuedOn}` : ''}
                </p>
              </div>

              <Badge variant={row.isPublic ? 'success' : 'outline'}>
                {row.isPublic ? tDocs('public') : tDocs('partnersOnly')}
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

      {draft ? (
        <DocumentDialog
          projectId={projectId}
          draft={draft}
          setDraft={setDraft}
          storageEnabled={storageEnabled}
        />
      ) : null}
    </section>
  )
}

function DocumentDialog({
  projectId,
  draft,
  setDraft,
  storageEnabled,
}: {
  projectId: string
  draft: Draft
  setDraft: (draft: Draft | null) => void
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tDocs = useTranslations('documents')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveProjectDocument({ ...draft, projectId })
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
          <Field label={t('title')} htmlFor="doc-title" required>
            <Input
              id="doc-title"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </Field>

          <Field label={tDocs('kind')} htmlFor="doc-kind">
            <Select
              id="doc-kind"
              value={draft.kind}
              onChange={(event) =>
                setDraft({ ...draft, kind: event.target.value as DocumentRow['kind'] })
              }
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {tDocs(`kinds.${kind}`)}
                </option>
              ))}
            </Select>
          </Field>

          <MediaPicker
            label={tDocs('file')}
            value={draft.mediaId}
            onChange={(mediaId) => setDraft({ ...draft, mediaId })}
            storageEnabled={storageEnabled}
          />

          <Field label={tDocs('description')} htmlFor="doc-description">
            <Textarea
              id="doc-description"
              rows={2}
              value={draft.description ?? ''}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tDocs('issuedOn')} htmlFor="doc-issued">
              <Input
                id="doc-issued"
                type="date"
                value={draft.issuedOn ?? ''}
                onChange={(event) => setDraft({ ...draft, issuedOn: event.target.value })}
              />
            </Field>
            <Field
              label={tDocs('expiresOn')}
              htmlFor="doc-expires"
              hint={tDocs('expiresHint')}
            >
              <Input
                id="doc-expires"
                type="date"
                value={draft.expiresOn ?? ''}
                onChange={(event) => setDraft({ ...draft, expiresOn: event.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-border p-3">
            <span>
              <span className="text-sm font-medium">{tDocs('makePublic')}</span>
              <span className="block text-xs text-muted-foreground">{tDocs('publicHint')}</span>
            </span>
            <Switch
              checked={draft.isPublic}
              onCheckedChange={(isPublic) => setDraft({ ...draft, isPublic })}
            />
          </label>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={save} disabled={pending || !draft.title.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
