'use client'

import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { pickI18n } from '@/i18n/config'
import type { NavItem } from '@/lib/settings/schema'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LanguageSwitcher } from './language-switcher'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { isExternalHref } from '@/lib/utils'

const linkClasses =
  'flex min-h-12 items-center rounded-[var(--radius-sm)] px-3 py-3 text-base font-medium transition-colors hover:bg-muted'

/**
 * Off-canvas navigation used below the `lg` breakpoint. Built on the `Dialog`
 * primitive rather than by hand so that Escape, the focus trap, focus restore,
 * scroll locking and keeping the closed panel out of the tab order all come
 * from Radix instead of being reimplemented here.
 */
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={t('menu')}
        className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-foreground transition-colors touch-target hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </DialogTrigger>

      <DialogContent
        side="end"
        closeLabel={t('close')}
        aria-describedby={undefined}
        className="gap-2 p-5 pb-[calc(1.25rem+var(--safe-bottom))] lg:hidden"
      >
        <DialogTitle className="flex min-h-9 items-center pb-2 pe-12 text-sm font-medium text-muted-foreground">
          {t('menu')}
        </DialogTitle>

        <nav aria-label={t('menu')} className="-mx-1 flex-1 overflow-y-auto px-1">
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
                      className={linkClasses}
                    >
                      {label}
                    </a>
                  ) : (
                    <Link href={item.href} className={linkClasses}>
                      {label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <LanguageSwitcher locales={locales} />
          <ThemeToggle />
        </div>
      </DialogContent>
    </Dialog>
  )
}
