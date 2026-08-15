'use client'

import { FileText, Loader2, Search, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { cn } from '@/lib/utils'

export type MediaItem = {
  id: string
  url: string
  objectKey: string
  originalName: string
  mimeType: string
  kind: 'image' | 'document' | 'video' | 'other'
  width: number | null
  height: number | null
  sizeBytes: number
  placeholder: string | null
  folder: string
  alt: Record<string, string | undefined>
  caption: Record<string, string | undefined>
  credit: string | null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Grid of uploaded assets with search, folder filter and drag-and-drop upload.
 * Shared by the media library page and the picker dialog.
 */
export function MediaBrowser({
  storageEnabled,
  selectedIds,
  onSelect,
  onOpenDetails,
  multiple = false,
  kind,
}: {
  storageEnabled: boolean
  selectedIds?: string[]
  onSelect?: (item: MediaItem) => void
  onOpenDetails?: (item: MediaItem) => void
  multiple?: boolean
  kind?: 'image' | 'document'
}) {
  const t = useTranslations('admin.media')
  const tCommon = useTranslations('admin.common')

  const [items, setItems] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('all')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (folder !== 'all') params.set('folder', folder)
      if (kind) params.set('kind', kind)

      const response = await fetch(`/api/admin/media?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('failed')

      const data = (await response.json()) as { items: MediaItem[]; folders: string[] }
      setItems(data.items)
      setFolders(data.folders)
    } catch {
      toast.error(tCommon('search'))
    } finally {
      setLoading(false)
    }
  }, [query, folder, kind, tCommon])

  useEffect(() => {
    const timer = setTimeout(load, query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  async function upload(files: FileList | File[]) {
    if (!storageEnabled) {
      toast.error(t('notConfigured'))
      return
    }

    setUploading(true)
    let failures = 0

    for (const file of Array.from(files)) {
      const body = new FormData()
      body.append('file', file)
      body.append('folder', folder === 'all' ? 'general' : folder)

      try {
        const response = await fetch('/api/admin/media/upload', { method: 'POST', body })
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string }
          failures += 1
          const message =
            data.error === 'too_large'
              ? t('tooLarge', { size: '25 MB' })
              : data.error === 'too_many_pixels'
                ? t('tooManyPixels')
                : data.error === 'type_mismatch'
                  ? t('typeMismatch')
                  : data.error === 'unsupported'
                    ? t('unsupported')
                    : t('notConfigured')
          toast.error(message)
        }
      } catch {
        failures += 1
      }
    }

    setUploading(false)
    if (failures === 0) toast.success(tCommon('newItem'))
    void load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tCommon('search')}
            aria-label={tCommon('search')}
            className="ps-9"
          />
        </div>

        <Select
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          aria-label={t('folder')}
          className="sm:w-44"
        >
          <option value="all">{t('folder')}</option>
          {folders.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>

        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !storageEnabled}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {uploading ? t('uploading') : t('upload')}
        </Button>

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={kind === 'image' ? 'image/*' : undefined}
          onChange={(event) => {
            if (event.target.files?.length) void upload(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {!storageEnabled ? (
        <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3 text-sm">
          {t('notConfigured')}
        </p>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (event.dataTransfer.files?.length) void upload(event.dataTransfer.files)
        }}
        className={cn(
          'rounded-[var(--radius-lg)] border-2 border-dashed p-3 transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {storageEnabled ? t('dropHere') : t('empty')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => {
              const selected = selectedIds?.includes(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => (onSelect ? onSelect(item) : onOpenDetails?.(item))}
                    onDoubleClick={() => onOpenDetails?.(item)}
                    className={cn(
                      'group flex w-full flex-col overflow-hidden rounded-[var(--radius-md)] border text-start transition-colors',
                      selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary',
                    )}
                  >
                    <span className="relative block aspect-square w-full overflow-hidden bg-muted">
                      {item.kind === 'image' && item.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- library thumbnails are not layout-critical
                        <img
                          src={item.url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-muted-foreground">
                          <FileText className="size-8" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5 p-2">
                      <span className="truncate text-xs font-medium">{item.originalName}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {multiple ? (
        <p className="text-xs text-muted-foreground">{t('altHint')}</p>
      ) : null}
    </div>
  )
}
