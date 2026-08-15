'use client'

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteEntity, saveCategory } from '@/app/actions/admin/content'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { locales, localeLabels, type Locale } from '@/i18n/config'
import { slugify } from '@/lib/utils'

export type CategoryRow = {
  id: string
  color: string | null
  sortOrder: number
  names: Partial<Record<Locale, string>>
}

export function CategoriesManager({ rows }: { rows: CategoryRow[] }) {
  const t = useTranslations('admin.nav')
  const tCommon = useTranslations('common')
  const tAdmin = useTranslations('admin.common')
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove(row: CategoryRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteEntity('category', row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={() => setCreating(true)} className="self-start">
        <Plus className="size-4" aria-hidden />
        {tAdmin('newItem')}
      </Button>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {tAdmin('noItems')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 md:flex-row md:items-center md:gap-4"
            >
              {/* The swatch belongs with the name, not on a line of its own. */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="size-4 shrink-0 rounded-full border border-border"
                  style={{ background: row.color ?? 'var(--color-muted)' }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.names.en ?? '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {locales
                      .filter((locale) => row.names[locale])
                      .map((locale) => `${locale}: ${row.names[locale]}`)
                      .join(' · ')}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pointer-coarse:gap-3">
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() => setEditing(row)}
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
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryDialog
        open={creating || Boolean(editing)}
        category={editing}
        title={t('categories')}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function CategoryDialog({
  open,
  category,
  title,
  onClose,
}: {
  open: boolean
  category: CategoryRow | null
  title: string
  onClose: () => void
}) {
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent closeLabel={tCommon('close')}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const data = Object.fromEntries(new FormData(event.currentTarget))

            const translations = Object.fromEntries(
              locales
                .filter((locale) => String(data[`name-${locale}`] ?? '').trim())
                .map((locale) => [
                  locale,
                  {
                    name: String(data[`name-${locale}`]),
                    slug: slugify(String(data[`name-${locale}`])),
                  },
                ]),
            )

            startTransition(async () => {
              const result = await saveCategory({
                id: category?.id,
                color: data.color || undefined,
                sortOrder: Number(data.sortOrder || 0),
                translations,
              })

              if (result.ok) {
                toast.success(tCommon('success.saved'))
                onClose()
              } else {
                toast.error(tCommon('error.generic'))
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {locales.map((locale) => (
              <Field key={locale} label={localeLabels[locale]} htmlFor={`name-${locale}`}>
                <Input
                  id={`name-${locale}`}
                  name={`name-${locale}`}
                  defaultValue={category?.names[locale] ?? ''}
                />
              </Field>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Colour" htmlFor="color">
                <Input
                  id="color"
                  name="color"
                  type="color"
                  defaultValue={category?.color ?? '#0a6d8f'}
                  className="h-11 p-1"
                />
              </Field>
              <Field label="Order" htmlFor="sortOrder">
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={category?.sortOrder ?? 0}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
