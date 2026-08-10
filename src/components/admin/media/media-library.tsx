'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { removeMedia, updateMedia } from '@/app/actions/admin/media'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { locales, localeLabels, type Locale } from '@/i18n/config'
import { MediaBrowser, formatBytes, type MediaItem } from './media-browser'

/** Media library page: browse, edit metadata, delete. */
export function MediaLibrary({ storageEnabled }: { storageEnabled: boolean }) {
  const t = useTranslations('admin.media')
  const tCommon = useTranslations('common')
  const tAdmin = useTranslations('admin.common')

  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [alt, setAlt] = useState<Record<string, string>>({})
  const [caption, setCaption] = useState<Record<string, string>>({})
  const [credit, setCredit] = useState('')
  const [folder, setFolder] = useState('general')
  const [key, setKey] = useState(0)
  const [pending, startTransition] = useTransition()

  function open(item: MediaItem) {
    setSelected(item)
    setAlt(Object.fromEntries(locales.map((locale) => [locale, item.alt?.[locale] ?? ''])))
    setCaption(Object.fromEntries(locales.map((locale) => [locale, item.caption?.[locale] ?? ''])))
    setCredit(item.credit ?? '')
    setFolder(item.folder)
  }

  function save() {
    if (!selected) return
    startTransition(async () => {
      const result = await updateMedia({ id: selected.id, alt, caption, credit, folder })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setSelected(null)
        setKey((value) => value + 1)
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  function destroy() {
    if (!selected) return
    if (!window.confirm(`${tAdmin('confirmDelete')} ${t('deleteWarning')}`)) return

    startTransition(async () => {
      const result = await removeMedia(selected.id)
      if (result.ok) {
        toast.success(tCommon('success.deleted'))
        setSelected(null)
        setKey((value) => value + 1)
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  return (
    <>
      <MediaBrowser key={key} storageEnabled={storageEnabled} onSelect={open} />

      <Dialog open={Boolean(selected)} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent closeLabel={tCommon('close')}>
          <DialogHeader>
            <DialogTitle>{selected?.originalName}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5">
            {selected?.kind === 'image' && selected.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary asset
              <img
                src={selected.url}
                alt=""
                className="max-h-64 w-full rounded-[var(--radius-md)] bg-muted object-contain"
              />
            ) : null}

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('dimensions')}</dt>
                <dd>{selected?.width && selected?.height ? `${selected.width}×${selected.height}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('size')}</dt>
                <dd>{selected ? formatBytes(selected.sizeBytes) : '—'}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">{t('altText')}</p>
              {locales.map((locale: Locale) => (
                <Field key={locale} label={localeLabels[locale]} htmlFor={`alt-${locale}`}>
                  <Input
                    id={`alt-${locale}`}
                    value={alt[locale] ?? ''}
                    onChange={(event) => setAlt({ ...alt, [locale]: event.target.value })}
                  />
                </Field>
              ))}
              <p className="text-xs text-muted-foreground">{t('altHint')}</p>
            </div>

            <Field label={t('caption')} htmlFor="caption-default">
              <Input
                id="caption-default"
                value={caption.en ?? ''}
                onChange={(event) => setCaption({ ...caption, en: event.target.value })}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('credit')} htmlFor="credit">
                <Input id="credit" value={credit} onChange={(event) => setCredit(event.target.value)} />
              </Field>
              <Field label={t('folder')} htmlFor="folder">
                <Input id="folder" value={folder} onChange={(event) => setFolder(event.target.value)} />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="danger" onClick={destroy} disabled={pending}>
              <Trash2 className="size-4" aria-hidden />
              {tCommon('delete')}
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
