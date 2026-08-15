'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Preference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'pw-theme'

function apply(preference: Preference) {
  const root = document.documentElement
  if (preference === 'system') {
    root.removeAttribute('data-theme')
    localStorage.removeItem(STORAGE_KEY)
  } else {
    root.setAttribute('data-theme', preference)
    localStorage.setItem(STORAGE_KEY, preference)
  }
}

/** Three-state switch: follow the OS, force light, force dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common.theme')
  const [preference, setPreference] = useState<Preference>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') setPreference(stored)
  }, [])

  const options: { value: Preference; icon: typeof Sun; label: string }[] = [
    { value: 'system', icon: Monitor, label: t('system') },
    { value: 'light', icon: Sun, label: t('light') },
    { value: 'dark', icon: Moon, label: t('dark') },
  ]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5',
        className,
      )}
      role="group"
      aria-label={t('label')}
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            setPreference(value)
            apply(value)
          }}
          aria-pressed={mounted ? preference === value : undefined}
          title={label}
          className={cn(
            // Three 28px pills sitting 2px apart cannot be hit reliably with a
            // thumb. Unlike the isolated icon buttons elsewhere, an invisible
            // 44px hit area would overlap its neighbours and the last sibling
            // would swallow their taps — so here the control itself grows.
            'grid size-7 place-items-center rounded-full transition-colors pointer-coarse:size-11',
            mounted && preference === value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-3.5 pointer-coarse:size-5" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
