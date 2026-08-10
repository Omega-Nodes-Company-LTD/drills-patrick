'use client'

import { Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { localeLabels, localeShortLabels, type Locale } from '@/i18n/config'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Switches locale while staying on the same route.
 *
 * Slugs differ per language, and the switcher deliberately keeps the current
 * one: the detail routes resolve a slug from any language and redirect to the
 * URL the target language uses (see `getProjectBySlug` and friends). Rewriting
 * the slug here as well would duplicate that logic in the browser, where it
 * cannot see the translations.
 */
export function LanguageSwitcher({
  locales,
  className,
  compact = false,
}: {
  locales: Locale[]
  className?: string
  compact?: boolean
}) {
  const current = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  function onChange(next: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: next })
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
