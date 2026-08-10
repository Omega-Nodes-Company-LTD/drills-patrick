'use client'

import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { locales, localeShortLabels, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

/**
 * Language tabs for translated fields. A dot marks the languages that already
 * have content, so an editor can see at a glance what is still missing.
 */
export function LocaleFields({
  enabledLocales = locales,
  isFilled,
  children,
  className,
}: {
  enabledLocales?: readonly Locale[]
  isFilled: (locale: Locale) => boolean
  children: (locale: Locale) => ReactNode
  className?: string
}) {
  const [active, setActive] = useState<Locale>(enabledLocales[0] ?? 'en')

  return (
    <Tabs value={active} onValueChange={(value) => setActive(value as Locale)} className={className}>
      <TabsList>
        {enabledLocales.map((locale) => (
          <TabsTrigger key={locale} value={locale} className="flex items-center gap-1.5">
            {localeShortLabels[locale]}
            <span
              className={cn(
                'grid size-3.5 place-items-center rounded-full text-[0.6rem]',
                isFilled(locale) ? 'bg-success/20 text-success' : 'bg-muted-foreground/20',
              )}
              aria-hidden
            >
              {isFilled(locale) ? <Check className="size-2.5" /> : null}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {enabledLocales.map((locale) => (
        <TabsContent key={locale} value={locale} className="flex flex-col gap-4">
          {children(locale)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
