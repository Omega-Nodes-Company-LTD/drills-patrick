'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Select } from '@/components/ui/field'
import { cn } from '@/lib/utils'

const STATUSES = ['all', 'planned', 'in_progress', 'completed'] as const

const TYPES = [
  'borehole',
  'shallow_well',
  'spring_protection',
  'rainwater_harvesting',
  'solar_pump',
  'rehabilitation',
  'piped_scheme',
] as const

/** Filters write to the query string so results stay linkable and cacheable. */
export function ProjectFilters({ districts }: { districts: string[] }) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const status = searchParams.get('status') ?? 'all'
  const type = searchParams.get('type') ?? ''
  const district = searchParams.get('district') ?? ''

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') params.delete(key)
    else params.set(key, value)
    params.delete('page')

    startTransition(() => {
      router.replace(`${pathname}${params.size > 0 ? `?${params}` : ''}`, { scroll: false })
    })
  }

  return (
    <div className={cn('flex flex-col gap-3', pending && 'opacity-70')}>
      <div
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={t('filters.status')}
      >
        {STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => update('status', value)}
            aria-pressed={status === value}
            className={cn(
              // The chips sit in a horizontal scroller, so growing them on
              // touch costs no layout elsewhere.
              'flex shrink-0 items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11',
              status === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary',
            )}
          >
            {t(`status.${value}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-xl">
        <Select
          aria-label={t('filters.type')}
          value={type}
          onChange={(event) => update('type', event.target.value)}
        >
          <option value="">{t('filters.type')}</option>
          {TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`type.${value}`)}
            </option>
          ))}
        </Select>

        {districts.length > 0 ? (
          <Select
            aria-label={t('filters.district')}
            value={district}
            onChange={(event) => update('district', event.target.value)}
          >
            <option value="">{t('filters.district')}</option>
            {districts.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {status !== 'all' || type || district ? (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="self-start text-sm text-primary underline underline-offset-4 touch-target"
        >
          {t('filters.reset')}
        </button>
      ) : (
        <span className="sr-only">{tCommon('all')}</span>
      )}
    </div>
  )
}
