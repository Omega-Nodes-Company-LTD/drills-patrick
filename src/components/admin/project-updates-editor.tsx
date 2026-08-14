'use client'

import { CalendarDays, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteProjectUpdate, saveProjectUpdate } from '@/app/actions/admin/project-updates'
import { LocaleFields } from '@/components/admin/locale-fields'
import { MediaPicker } from '@/components/admin/media/media-picker'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
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
import { Field, Input, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { localeLabels, type Locale } from '@/i18n/config'

export type ProjectUpdateRow = {
  id: string
  projectId: string
  mediaId: string | null
  happenedOn: string
  sortOrder: number
  isPublished: boolean
  translations: Partial<Record<Locale, { title: string; body: string }>>
}

export type UpdateDraft = Omit<ProjectUpdateRow, 'id'> & { id?: string }

export const emptyUpdateDraft = (projectId: string, sortOrder: number): UpdateDraft => ({
  projectId,
  mediaId: null,
  happenedOn: new Date().toISOString().slice(0, 10),
  sortOrder,
  isPublished: true,
  translations: {},
})

/**
 * Timeline of a project. Kept separate from the project form because entries
 * are added over months, long after the project itself was created.
 */
export function ProjectUpdatesEditor({
  projectId,
  rows,
  enabledLocales,
  storageEnabled,
}: {
  projectId: string
  rows: ProjectUpdateRow[]
  enabledLocales: Locale[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const tProject = useTranslations('projects')
  const [draft, setDraft] = useState<UpdateDraft | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(row: ProjectUpdateRow) {
    if (!window.confirm(`${t('confirmDelete')} ${t('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteProjectUpdate(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  function titleOf(row: ProjectUpdateRow) {
    for (const locale of enabledLocales) {
      const title = row.translations[locale]?.title
      if (title?.trim()) return title
    }
    return '—'
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden />
          {tProject('timeline')}
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() => setDraft(emptyUpdateDraft(projectId, rows.length))}
        >
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
                <p className="truncate font-medium">{titleOf(row)}</p>
                <p className="text-xs text-muted-foreground">{row.happenedOn}</p>
              </div>
              {row.isPublished ? null : <Badge variant="outline">{t('draft')}</Badge>}
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
        <UpdateDialog
          draft={draft}
          setDraft={setDraft}
          enabledLocales={enabledLocales}
          storageEnabled={storageEnabled}
        />
      ) : null}
    </section>
  )
}

/**
 * Shared with the site-wide field-updates screen, which is why the project is
 * carried on the draft and offered as a choice when a list is passed: the same
 * entry is edited from inside its project and from the list of everything.
 */
export function UpdateDialog({
  draft,
  setDraft,
  enabledLocales,
  storageEnabled,
  projects,
}: {
  draft: UpdateDraft
  setDraft: (draft: UpdateDraft | null) => void
  enabledLocales: Locale[]
  storageEnabled: boolean
  projects?: { id: string; title: string }[]
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const tProjects = useTranslations('projects')
  const [pending, startTransition] = useTransition()

  const setTranslation = (locale: Locale, patch: { title?: string; body?: string }) =>
    setDraft({
      ...draft,
      translations: {
        ...draft.translations,
        [locale]: {
          title: draft.translations[locale]?.title ?? '',
          body: draft.translations[locale]?.body ?? '',
          ...patch,
        },
      },
    })

  function save() {
    startTransition(async () => {
      const result = await saveProjectUpdate(draft)
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

        <DialogBody className="flex flex-col gap-5">
          {projects ? (
            <Field label={tProjects('title')} htmlFor="updateProject" required>
              <Select
                id="updateProject"
                value={draft.projectId}
                onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('date')} htmlFor="happenedOn" required>
              <Input
                id="happenedOn"
                type="date"
                value={draft.happenedOn}
                onChange={(event) => setDraft({ ...draft, happenedOn: event.target.value })}
              />
            </Field>
            <Field label={t('sortOrder')} htmlFor="updateSortOrder">
              <Input
                id="updateSortOrder"
                type="number"
                value={draft.sortOrder}
                onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })}
              />
            </Field>
          </div>

          <MediaPicker
            label={t('coverImage')}
            value={draft.mediaId}
            onChange={(mediaId) => setDraft({ ...draft, mediaId })}
            storageEnabled={storageEnabled}
          />

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('published')}</span>
            <Switch
              checked={draft.isPublished}
              onCheckedChange={(isPublished) => setDraft({ ...draft, isPublished })}
            />
          </label>

          <LocaleFields
            enabledLocales={enabledLocales}
            isFilled={(locale) => Boolean(draft.translations[locale]?.title?.trim())}
          >
            {(locale) => (
              <div className="flex flex-col gap-4">
                <Field label={`${t('title')} · ${localeLabels[locale]}`}>
                  <Input
                    value={draft.translations[locale]?.title ?? ''}
                    onChange={(event) => setTranslation(locale, { title: event.target.value })}
                  />
                </Field>
                <Field label={localeLabels[locale]}>
                  <RichTextEditor
                    value={draft.translations[locale]?.body ?? ''}
                    onChange={(body) => setTranslation(locale, { body })}
                    storageEnabled={storageEnabled}
                  />
                </Field>
              </div>
            )}
          </LocaleFields>
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
