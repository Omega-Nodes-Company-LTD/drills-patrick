'use client'

import { useState } from 'react'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { Input, Label, Textarea } from '@/components/ui/field'
import { locales, localeShortLabels, type Locale } from '@/i18n/config'
import type { I18nTextValue } from '@/i18n/schema'
import { cn } from '@/lib/utils'

/**
 * Compact translated field: one small language switch above the control, so a
 * block form does not turn into five stacked copies of the same input.
 */
export function I18nField({
  label,
  value,
  onChange,
  variant = 'input',
  rows = 3,
  storageEnabled = false,
  placeholder,
}: {
  label: string
  value: I18nTextValue | undefined
  onChange: (value: I18nTextValue) => void
  variant?: 'input' | 'textarea' | 'rich'
  rows?: number
  storageEnabled?: boolean
  placeholder?: string
}) {
  const [active, setActive] = useState<Locale>('en')
  const current = value?.[active] ?? ''

  const update = (next: string) => onChange({ ...(value ?? {}), [active]: next })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex gap-0.5">
          {locales.map((locale) => {
            const filled = Boolean((value?.[locale] ?? '').trim())
            return (
              <button
                key={locale}
                type="button"
                onClick={() => setActive(locale)}
                aria-pressed={active === locale}
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                  active === locale
                    ? 'bg-primary text-primary-foreground'
                    : filled
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {localeShortLabels[locale]}
              </button>
            )
          })}
        </div>
      </div>

      {variant === 'rich' ? (
        <RichTextEditor
          key={active}
          value={current}
          onChange={update}
          storageEnabled={storageEnabled}
        />
      ) : variant === 'textarea' ? (
        <Textarea
          rows={rows}
          value={current}
          placeholder={placeholder}
          onChange={(event) => update(event.target.value)}
        />
      ) : (
        <Input
          value={current}
          placeholder={placeholder}
          onChange={(event) => update(event.target.value)}
        />
      )}
    </div>
  )
}
