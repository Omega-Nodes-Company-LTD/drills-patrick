'use client'

import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { pickI18n } from '@/i18n/config'
import type { NavItem } from '@/lib/settings/schema'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from './language-switcher'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn, isExternalHref } from '@/lib/utils'

/** Off-canvas navigation used below the `lg` breakpoint. */
export function MobileNav({
  items,
  locale,
  locales,
}: {
  items: NavItem[]
  locale: Locale
  locales: Locale[]
}) {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close when the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while the panel is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('menu')}
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-foreground transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
        />
        <nav
          className={cn(
            'absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col gap-2 overflow-y-auto bg-background p-5 shadow-token-lg transition-transform duration-250',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
          aria-label={t('menu')}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('menu')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close')}
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const label = pickI18n(item.label, locale)
              return (
                <li key={item.id}>
                  {item.highlight ? (
                    <Button asChild className="mt-2 w-full" size="lg">
                      <Link href={item.href}>{label}</Link>
                    </Button>
                  ) : isExternalHref(item.href) ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block rounded-[var(--radius-sm)] px-3 py-3 text-base font-medium transition-colors hover:bg-muted"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="block rounded-[var(--radius-sm)] px-3 py-3 text-base font-medium transition-colors hover:bg-muted"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
            <LanguageSwitcher locales={locales} />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </>
  )
}
