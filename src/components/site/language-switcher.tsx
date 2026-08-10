'use client'

import { Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { useTransition } from 'react'
import { localeLabels, localeShortLabels, type Locale } from '@/i18n/config'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Switches locale while staying on the same route. Slugs differ per language,
 * so `alternates` carries the translated slug for the current entity when the
 * route has one.
 */
export function LanguageSwitcher({
  locales,
  alternates,
  className,
  compact = false,
}: {
  locales: Locale[]
  alternates?: Partial<Record<Locale, string>>
  className?: string
  compact?: boolean
}) {
  const current = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [pending, startTransition] = useTransition()

  function onChange(next: Locale) {
    const slug = alternates?.[next]

    startTransition(() => {
      if (slug && typeof params.slug === 'string') {
        // Replace the current slug segment with the one for the target locale.
        const segments = pathname.split('/')
        segments[segments.length - 1] = slug
        router.replace(segments.join('/'), { locale: next })
      } else {
        router.replace(pathname, { locale: next })
      }
    })
  }

  if (locales.length <= 1) return null

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <Globe className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" aria-hidden />
      <select
        value={current}
        onChange={(event) => onChange(event.target.value as Locale)}
        disabled={pending}
        aria-label={localeLabels[current]}
        className="h-9 appearance-none rounded-full border border-border bg-surface pl-8 pr-7 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {compact ? localeShortLabels[locale] : localeLabels[locale]}
          </option>
        ))}
      </select>
    </div>
  )
}
