'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  total,
  perPage,
}: {
  page: number
  total: number
  perPage: number
}) {
  const t = useTranslations('common')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageCount = Math.max(1, Math.ceil(total / perPage))

  if (pageCount <= 1) return null

  function href(target: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (target <= 1) params.delete('page')
    else params.set('page', String(target))
    return `${pathname}${params.size > 0 ? `?${params}` : ''}`
  }

  const linkClass =
    'inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-4 text-sm font-medium transition-colors hover:border-primary'

  return (
    <nav className="mt-10 flex items-center justify-between gap-4" aria-label={t('page')}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          <ChevronLeft className="size-4" aria-hidden />
          {t('previous')}
        </Link>
      ) : (
        <span className={cn(linkClass, 'pointer-events-none opacity-40')} aria-hidden>
          <ChevronLeft className="size-4" />
          {t('previous')}
        </span>
      )}

      <span className="text-sm text-muted-foreground">
        {t('page')} {page} {t('of')} {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          {t('next')}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={cn(linkClass, 'pointer-events-none opacity-40')} aria-hidden>
          {t('next')}
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  )
}
