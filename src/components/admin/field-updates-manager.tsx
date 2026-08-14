'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteProjectUpdate } from '@/app/actions/admin/project-updates'
import {
  UpdateDialog,
  emptyUpdateDraft,
  type ProjectUpdateRow,
  type UpdateDraft,
} from '@/components/admin/project-updates-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import type { Locale } from '@/i18n/config'

/**
 * Every field update on the installation, in one place.
 *
 * The per-project editor is still the right tool while a project is open, but
 * entries arrive in date order from whichever sites are active — so writing up
 * a week in the field meant opening each project in turn to find the timeline
 * buried at the bottom of its form.
 */
export function FieldUpdatesManager({
  rows,
  projects,
  enabledLocales,
  storageEnabled,
}: {
  rows: ProjectUpdateRow[]
  projects: { id: string; title: string }[]
  enabledLocales: Locale[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const tProjects = useTranslations('projects')
  const [draft, setDraft] = useState<UpdateDraft | null>(null)
  const [project, setProject] = useState('')
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()

  const titles = useMemo(
    () => new Map(projects.map((entry) => [entry.id, entry.title])),
    [projects],
  )

  function titleOf(row: ProjectUpdateRow) {
    for (const locale of enabledLocales) {
      const title = row.translations[locale]?.title
      if (title?.trim()) return title
    }
    return '—'
  }

  const visible = rows.filter((row) => {
    if (project && row.projectId !== project) return false
    if (!search.trim()) return true

    const term = search.trim().toLowerCase()
    return (
      titleOf(row).toLowerCase().includes(term) ||
      (titles.get(row.projectId) ?? '').toLowerCase().includes(term)
    )
  })

  function remove(row: ProjectUpdateRow) {
    if (!window.confirm(`${t('confirmDelete')} ${t('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteProjectUpdate(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tCommon('search')} htmlFor="updateSearch" className="min-w-52 flex-1">
          <Input
            id="updateSearch"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label={tProjects('title')} htmlFor="updateFilter" className="min-w-52">
          <Select
            id="updateFilter"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option value="">{tCommon('all')}</option>
            {projects.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          disabled={projects.length === 0}
          onClick={() =>
            setDraft(emptyUpdateDraft(project || projects[0]?.id || '', rows.length))
          }
        >
          <Plus className="size-4" aria-hidden />
          {t('newItem')}
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {projects.length === 0 ? t('noItems') : tCommon('noResults')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{titleOf(row)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.happenedOn} · {titles.get(row.projectId) ?? '—'}
                </p>
              </div>
              {row.mediaId ? <Badge variant="outline">{t('coverImage')}</Badge> : null}
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
          projects={projects}
        />
      ) : null}
    </div>
  )
}
