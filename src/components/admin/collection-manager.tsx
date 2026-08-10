'use client'

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteCollectionItem, saveCollectionItem } from '@/app/actions/admin/collections'
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
import { Field, Input, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { localeLabels, type Locale } from '@/i18n/config'
import {
  collections,
  type CollectionItem,
  type CollectionKey,
  type FieldDef,
} from '@/lib/admin/collection-fields'

/**
 * One editor for every small collection — FAQs, partners, team members and
 * testimonials. The form is generated from the field definitions, which the
 * server also validates against, so the two cannot drift apart.
 */

type Draft = {
  id?: string
  sortOrder: number
  base: Record<string, unknown>
  translations: Record<string, Partial<Record<Locale, string>>>
}

function emptyDraft(key: CollectionKey, sortOrder: number): Draft {
  const base: Record<string, unknown> = {}
  const translations: Record<string, Partial<Record<Locale, string>>> = {}

  for (const field of collections[key].fields) {
    if (field.translated) translations[field.name] = {}
    else base[field.name] = field.type === 'switch' ? true : ''
  }

  return { sortOrder, base, translations }
}

function toDraft(key: CollectionKey, item: CollectionItem): Draft {
  const base: Record<string, unknown> = {}

  for (const field of collections[key].fields.filter((entry) => !entry.translated)) {
    const value = item.base[field.name]
    base[field.name] = field.type === 'switch' ? value !== false : (value ?? '')
  }

  return {
    id: item.id,
    sortOrder: item.sortOrder,
    base,
    translations: structuredClone(item.translations),
  }
}

export function CollectionManager({
  collectionKey,
  items,
  enabledLocales,
  storageEnabled,
}: {
  collectionKey: CollectionKey
  items: CollectionItem[]
  enabledLocales: Locale[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const def = collections[collectionKey]
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  const hasPublishField = def.fields.some((field) => field.name === 'isPublished')

  function remove(item: CollectionItem) {
    if (!window.confirm(`${t('confirmDelete')} ${t('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteCollectionItem(collectionKey, item.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  function label(item: CollectionItem): string {
    const fromBase = item.base[def.labelField]
    if (typeof fromBase === 'string' && fromBase.trim()) return fromBase

    const translated = item.translations[def.labelField]
    if (translated) {
      for (const locale of enabledLocales) {
        const value = translated[locale]
        if (value?.trim()) return value
      }
    }

    return '—'
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        className="self-start"
        onClick={() => setDraft(emptyDraft(collectionKey, items.length))}
      >
        <Plus className="size-4" aria-hidden />
        {t('newItem')}
      </Button>

      {items.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t('noItems')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{label(item)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {enabledLocales
                    .filter((locale) =>
                      Object.values(item.translations).some((values) => values[locale]?.trim()),
                    )
                    .join(' · ') || t('missingTranslation')}
                </p>
              </div>

              {hasPublishField && item.base.isPublished === false ? (
                <Badge variant="outline">{t('draft')}</Badge>
              ) : null}

              <Button
                size="iconSm"
                variant="ghost"
                onClick={() => setDraft(toDraft(collectionKey, item))}
                title={tCommon('edit')}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                size="iconSm"
                variant="ghost"
                onClick={() => remove(item)}
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
        <CollectionDialog
          collectionKey={collectionKey}
          draft={draft}
          setDraft={setDraft}
          enabledLocales={enabledLocales}
          storageEnabled={storageEnabled}
        />
      ) : null}
    </div>
  )
}

function CollectionDialog({
  collectionKey,
  draft,
  setDraft,
  enabledLocales,
  storageEnabled,
}: {
  collectionKey: CollectionKey
  draft: Draft
  setDraft: (draft: Draft | null) => void
  enabledLocales: Locale[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const def = collections[collectionKey]
  const [pending, startTransition] = useTransition()

  const setBase = (name: string, value: unknown) =>
    setDraft({ ...draft, base: { ...draft.base, [name]: value } })

  const setTranslation = (name: string, locale: Locale, value: string) =>
    setDraft({
      ...draft,
      translations: {
        ...draft.translations,
        [name]: { ...draft.translations[name], [locale]: value },
      },
    })

  const baseFields = def.fields.filter((field) => !field.translated)
  const translatedFields = def.fields.filter((field) => field.translated)

  function save() {
    startTransition(async () => {
      const result = await saveCollectionItem(collectionKey, draft)
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
          {baseFields.map((field) => (
            <BaseField
              key={field.name}
              field={field}
              value={draft.base[field.name]}
              onChange={(value) => setBase(field.name, value)}
              storageEnabled={storageEnabled}
            />
          ))}

          <Field label={t('sortOrder')} htmlFor="sortOrder">
            <Input
              id="sortOrder"
              type="number"
              value={draft.sortOrder}
              onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })}
            />
          </Field>

          {translatedFields.length > 0 ? (
            <LocaleFields
              enabledLocales={enabledLocales}
              isFilled={(locale) =>
                translatedFields.some((field) =>
                  draft.translations[field.name]?.[locale]?.trim(),
                )
              }
            >
              {(locale) => (
                <div className="flex flex-col gap-4">
                  {translatedFields.map((field) => (
                    <TranslatedField
                      key={`${field.name}-${locale}`}
                      field={field}
                      locale={locale}
                      value={draft.translations[field.name]?.[locale] ?? ''}
                      onChange={(value) => setTranslation(field.name, locale, value)}
                      storageEnabled={storageEnabled}
                    />
                  ))}
                </div>
              )}
            </LocaleFields>
          ) : null}
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

function BaseField({
  field,
  value,
  onChange,
  storageEnabled,
}: {
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  storageEnabled: boolean
}) {
  if (field.type === 'switch') {
    return (
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{field.label}</span>
        <Switch checked={value !== false} onCheckedChange={onChange} />
      </label>
    )
  }

  if (field.type === 'image') {
    return (
      <MediaPicker
        label={field.label}
        value={typeof value === 'string' && value ? value : null}
        onChange={onChange}
        storageEnabled={storageEnabled}
      />
    )
  }

  if (field.type === 'textarea') {
    return (
      <Field label={field.label} hint={field.hint} required={field.required}>
        <Textarea
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    )
  }

  return (
    <Field label={field.label} hint={field.hint} required={field.required}>
      <Input
        type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function TranslatedField({
  field,
  locale,
  value,
  onChange,
  storageEnabled,
}: {
  field: FieldDef
  locale: Locale
  value: string
  onChange: (value: string) => void
  storageEnabled: boolean
}) {
  const label = `${field.label} · ${localeLabels[locale]}`

  if (field.type === 'richtext') {
    return (
      <Field label={label} hint={field.hint} required={field.required}>
        <RichTextEditor value={value} onChange={onChange} storageEnabled={storageEnabled} />
      </Field>
    )
  }

  if (field.type === 'textarea') {
    return (
      <Field label={label} hint={field.hint} required={field.required}>
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
    )
  }

  return (
    <Field label={label} hint={field.hint} required={field.required}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}
