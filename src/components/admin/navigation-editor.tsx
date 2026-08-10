'use client'

import { Loader2, MoveDown, MoveUp, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveNavigation } from '@/app/actions/admin/appearance'
import { I18nField } from '@/components/admin/blocks/i18n-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import type { NavItem } from '@/lib/settings/schema'
import { createId } from '@/lib/utils'

/** One editable menu (header, footer or legal). */
export function NavigationEditor({
  menuKey,
  title,
  initial,
}: {
  menuKey: 'header' | 'footer' | 'legal'
  title: string
  initial: NavItem[]
}) {
  const t = useTranslations('admin.navigation')
  const tCommon = useTranslations('common')
  const [items, setItems] = useState<NavItem[]>(initial)
  const [pending, startTransition] = useTransition()

  const update = (index: number, patch: Partial<NavItem>) =>
    setItems(items.map((item, position) => (position === index ? { ...item, ...patch } : item)))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    setItems(next)
  }

  function save() {
    startTransition(async () => {
      const result = await saveNavigation(menuKey, items)
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {tCommon('save')}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-[var(--radius-md)] border border-border p-3">
            <div className="mb-3 flex items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={tCommon('previous')}
                className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <MoveUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={tCommon('next')}
                className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <MoveDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, position) => position !== index))}
                aria-label={tCommon('delete')}
                className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <I18nField
                label={t('label')}
                value={item.label}
                onChange={(label) => update(index, { label })}
              />
              <Field label={t('url')}>
                <Input value={item.href} onChange={(event) => update(index, { href: event.target.value })} />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={item.external}
                  onCheckedChange={(external) => update(index, { external })}
                />
                {t('external')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={item.highlight}
                  onCheckedChange={(highlight) => update(index, { highlight })}
                />
                {t('highlight')}
              </label>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() =>
            setItems([
              ...items,
              { id: createId(), label: {}, href: '/', external: false, highlight: false, children: [] },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          {t('addItem')}
        </Button>
      </CardContent>
    </Card>
  )
}
