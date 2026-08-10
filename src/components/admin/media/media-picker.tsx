'use client'

import { ImagePlus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MediaBrowser, type MediaItem } from './media-browser'

/**
 * Single-image field with a preview and a picker dialog. Used for covers,
 * logos and any other one-image reference.
 */
export function MediaPicker({
  value,
  onChange,
  storageEnabled,
  label,
  className,
}: {
  value: string | null
  onChange: (id: string | null) => void
  storageEnabled: boolean
  label?: string
  className?: string
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<MediaItem | null>(null)

  // Resolve the stored id to a preview when the field is first rendered.
  // Looked up by id rather than searched for in the newest page, or a cover
  // chosen last year would show as an empty box.
  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    if (preview?.id === value) return

    let cancelled = false
    void fetch(`/api/admin/media?ids=${encodeURIComponent(value)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { items: MediaItem[] } | null) => {
        if (cancelled || !data) return
        setPreview(data.items.find((item) => item.id === value) ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [value, preview?.id])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? <span className="text-sm font-medium">{label}</span> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-border bg-muted transition-colors hover:border-primary"
        >
          {preview?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary asset preview
            <img src={preview.url} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          )}
        </button>

        <div className="flex flex-col gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            {value ? t('changeImage') : t('selectImage')}
          </Button>
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setPreview(null)
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger"
            >
              <X className="size-3" aria-hidden />
              {t('removeImage')}
            </button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tCommon('close')} className="sm:w-[min(60rem,94vw)]">
          <DialogHeader>
            <DialogTitle>{t('selectImage')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <MediaBrowser
              storageEnabled={storageEnabled}
              kind="image"
              selectedIds={value ? [value] : []}
              onSelect={(item) => {
                onChange(item.id)
                setPreview(item)
                setOpen(false)
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tCommon('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Multi-image field used by galleries. */
export function MediaGalleryPicker({
  value,
  onChange,
  storageEnabled,
  label,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  storageEnabled: boolean
  label?: string
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MediaItem[]>([])

  useEffect(() => {
    if (value.length === 0) {
      setItems([])
      return
    }

    let cancelled = false
    void fetch(`/api/admin/media?ids=${value.map(encodeURIComponent).join(',')}`, {
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { items: MediaItem[] } | null) => {
        if (cancelled || !data) return
        const map = new Map(data.items.map((item) => [item.id, item]))
        // Kept in the order the gallery stores, not the order the API returns.
        setItems(value.map((id) => map.get(id)).filter(Boolean) as MediaItem[])
      })

    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-medium">{label}</span> : null}

      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary asset preview */}
            <img
              src={item.url}
              alt=""
              className="size-20 rounded-[var(--radius-sm)] border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((id) => id !== item.id))}
              aria-label={t('removeImage')}
              className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-danger text-white"
            >
              <X className="size-3" aria-hidden />
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-20 place-items-center rounded-[var(--radius-sm)] border border-dashed border-border text-muted-foreground transition-colors hover:border-primary"
          >
            <ImagePlus className="size-5" aria-hidden />
          </button>
        </li>
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tCommon('close')} className="sm:w-[min(60rem,94vw)]">
          <DialogHeader>
            <DialogTitle>{t('gallery')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <MediaBrowser
              storageEnabled={storageEnabled}
              kind="image"
              multiple
              selectedIds={value}
              onSelect={(item) => {
                onChange(value.includes(item.id) ? value.filter((id) => id !== item.id) : [...value, item.id])
              }}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              {tCommon('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
