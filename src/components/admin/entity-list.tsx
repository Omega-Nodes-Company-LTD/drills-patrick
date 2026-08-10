'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { deleteEntity, setPublishStatus } from '@/app/actions/admin/content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { intlLocale, locales, localeShortLabels, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

export type EntityRow = {
  id: string
  title: string
  status: string
  updatedAt: string
  translatedLocales: Locale[]
  meta?: string
  editHref: string
  canDelete?: boolean
}

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  published: 'success',
  draft: 'warning',
  archived: 'default',
}

/**
 * Listing used by posts, projects, campaigns and pages: one card per row on
 * phones, a table-like layout from `md` upwards.
 */
export function EntityList({
  rows,
  type,
  locale,
  emptyMessage,
}: {
  rows: EntityRow[]
  type: 'post' | 'project' | 'campaign' | 'page'
  locale: Locale
  emptyMessage: string
}) {
  const t = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  function togglePublish(row: EntityRow) {
    startTransition(async () => {
      const next = row.status === 'published' ? 'draft' : 'published'
      const result = await setPublishStatus(type, row.id, next)
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  function destroy(row: EntityRow) {
    if (!window.confirm(`${t('confirmDelete')} ${t('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteEntity(type, row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(result.error === 'system_page' ? t('confirmDeleteText') : tCommon('error.generic'))
    })
  }

  return (
    <ul className={cn('flex flex-col gap-2', pending && 'opacity-70')}>
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 md:flex-row md:items-center md:gap-4"
        >
          <div className="min-w-0 flex-1">
            <Link href={row.editHref} className="font-medium hover:underline">
              {row.title}
            </Link>
            {row.meta ? <p className="text-xs text-muted-foreground">{row.meta}</p> : null}
          </div>

          <div className="flex items-center gap-1" aria-label={t('translations')}>
            {locales.map((entry) => (
              <span
                key={entry}
                title={entry}
                className={cn(
                  'rounded px-1 text-[0.65rem] font-medium',
                  row.translatedLocales.includes(entry)
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground/60',
                )}
              >
                {localeShortLabels[entry]}
              </span>
            ))}
          </div>

          <Badge variant={statusVariant[row.status] ?? 'default'} className="shrink-0">
            {t(row.status === 'published' ? 'published' : row.status === 'draft' ? 'draft' : 'archived')}
          </Badge>

          <span className="shrink-0 text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(intlLocale(locale), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }).format(new Date(row.updatedAt))}
          </span>

          <div className="flex shrink-0 items-center gap-1">
            <Button asChild size="iconSm" variant="ghost" title={tCommon('edit')}>
              <Link href={row.editHref}>
                <Pencil className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => togglePublish(row)}
              disabled={pending}
              title={row.status === 'published' ? t('unpublish') : t('publish')}
            >
              <MoreHorizontal className="size-4" aria-hidden />
              <span className="sr-only md:not-sr-only md:text-xs">
                {row.status === 'published' ? t('unpublish') : t('publish')}
              </span>
            </Button>
            {row.canDelete !== false ? (
              <Button
                size="iconSm"
                variant="ghost"
                onClick={() => destroy(row)}
                disabled={pending}
                title={tCommon('delete')}
                className="text-muted-foreground hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
