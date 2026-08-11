'use client'

import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteIndicator,
  deleteSpendingEntry,
  saveIndicator,
  saveSpendingEntry,
} from '@/app/actions/admin/transparency'
import { LocaleFields } from '@/components/admin/locale-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { localeLabels, type Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'

/**
 * The published numbers: impact indicators and yearly spending.
 *
 * Methodology is a required field on an indicator, and the form says why.
 * The whole page exists so a figure on the public site can be traced to how
 * it was produced, and a blank method quietly defeats that.
 */

export type IndicatorRow = {
  id: string
  key: string
  value: string
  unit: string | null
  methodology: string
  source: string | null
  verifiedOn: string | null
  sortOrder: number
  translations: Partial<Record<Locale, { label: string; methodology: string }>>
}

export type SpendingRow = {
  id: string
  year: number
  category: string
  amount: string
  amountMinor: number
  currency: string
  note: string | null
  sortOrder: number
  translations: Partial<Record<Locale, { label: string }>>
}

export function TransparencyManager({
  indicators,
  spending,
  enabledLocales,
  locale,
}: {
  indicators: IndicatorRow[]
  spending: SpendingRow[]
  enabledLocales: Locale[]
  locale: Locale
}) {
  const t = useTranslations('admin.transparency')

  return (
    <Tabs defaultValue="indicators" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="indicators">{t('indicators')}</TabsTrigger>
        <TabsTrigger value="spending">{t('spending')}</TabsTrigger>
      </TabsList>

      <TabsContent value="indicators">
        <IndicatorsPanel rows={indicators} enabledLocales={enabledLocales} />
      </TabsContent>

      <TabsContent value="spending">
        <SpendingPanel rows={spending} enabledLocales={enabledLocales} locale={locale} />
      </TabsContent>
    </Tabs>
  )
}

function IndicatorsPanel({
  rows,
  enabledLocales,
}: {
  rows: IndicatorRow[]
  enabledLocales: Locale[]
}) {
  const t = useTranslations('admin.transparency')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<IndicatorRow | null>(null)
  const [pending, startTransition] = useTransition()

  const empty = (): IndicatorRow => ({
    id: '',
    key: '',
    value: '',
    unit: null,
    methodology: '',
    source: null,
    verifiedOn: null,
    sortOrder: rows.length,
    translations: {},
  })

  function save() {
    if (!draft) return

    startTransition(async () => {
      const result = await saveIndicator({ ...draft, id: draft.id || undefined })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(t('methodRequired'))
      }
    })
  }

  function remove(row: IndicatorRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteIndicator(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t('indicators')}</CardTitle>
        <Button type="button" size="sm" onClick={() => setDraft(empty())}>
          <Plus className="size-4" aria-hidden />
          {tAdmin('newItem')}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tAdmin('noItems')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.value}
                    {row.unit ? ` ${row.unit}` : ''} · {row.key}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.verifiedOn ? `${t('verified')} ${row.verifiedOn}` : t('unverified')}
                  </p>
                </div>
                <Button size="iconSm" variant="ghost" onClick={() => setDraft(row)}>
                  {tCommon('edit')}
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() => remove(row)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('key')} hint="people-served, wells-built…" required>
                <Input
                  value={draft.key}
                  onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                />
              </Field>
              <Field label={t('value')} required>
                <Input
                  value={draft.value}
                  onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                />
              </Field>
              <Field label={t('unit')}>
                <Input
                  value={draft.unit ?? ''}
                  onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                />
              </Field>
              <Field label={t('verifiedOn')}>
                <Input
                  type="date"
                  value={draft.verifiedOn ?? ''}
                  onChange={(event) => setDraft({ ...draft, verifiedOn: event.target.value })}
                />
              </Field>
            </div>

            <Field label={t('methodology')} hint={t('methodologyHint')} required>
              <Textarea
                rows={3}
                value={draft.methodology}
                onChange={(event) => setDraft({ ...draft, methodology: event.target.value })}
              />
            </Field>

            <Field label={t('source')}>
              <Input
                value={draft.source ?? ''}
                onChange={(event) => setDraft({ ...draft, source: event.target.value })}
              />
            </Field>

            <LocaleFields
              enabledLocales={enabledLocales}
              isFilled={(entry) => Boolean(draft.translations[entry]?.label?.trim())}
            >
              {(entry) => (
                <div className="flex flex-col gap-3">
                  <Field label={`${t('label')} · ${localeLabels[entry]}`}>
                    <Input
                      value={draft.translations[entry]?.label ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          translations: {
                            ...draft.translations,
                            [entry]: {
                              label: event.target.value,
                              methodology: draft.translations[entry]?.methodology ?? '',
                            },
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={`${t('methodology')} · ${localeLabels[entry]}`}>
                    <Textarea
                      rows={2}
                      value={draft.translations[entry]?.methodology ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          translations: {
                            ...draft.translations,
                            [entry]: {
                              label: draft.translations[entry]?.label ?? '',
                              methodology: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              )}
            </LocaleFields>

            <div className="flex gap-2">
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {tCommon('save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SpendingPanel({
  rows,
  enabledLocales,
  locale,
}: {
  rows: SpendingRow[]
  enabledLocales: Locale[]
  locale: Locale
}) {
  const t = useTranslations('admin.transparency')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<SpendingRow | null>(null)
  const [pending, startTransition] = useTransition()

  const empty = (): SpendingRow => ({
    id: '',
    year: new Date().getFullYear(),
    category: '',
    amount: '0',
    amountMinor: 0,
    currency: 'EUR',
    note: null,
    sortOrder: rows.length,
    translations: {},
  })

  function save() {
    if (!draft) return

    startTransition(async () => {
      const result = await saveSpendingEntry({ ...draft, id: draft.id || undefined })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  function remove(row: SpendingRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteSpendingEntry(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t('spending')}</CardTitle>
        <Button type="button" size="sm" onClick={() => setDraft(empty())}>
          <Plus className="size-4" aria-hidden />
          {tAdmin('newItem')}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tAdmin('noItems')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.year} · {row.category}
                  </p>
                </div>
                <span className="tabular-nums">
                  {formatMoney(row.amountMinor, row.currency, locale, { hideDecimals: true })}
                </span>
                <Button size="iconSm" variant="ghost" onClick={() => setDraft(row)}>
                  {tCommon('edit')}
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() => remove(row)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label={t('year')} required>
                <Input
                  type="number"
                  value={draft.year}
                  onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
                />
              </Field>
              <Field label={t('category')} required>
                <Input
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                />
              </Field>
              <Field label={t('amount')} required>
                <Input
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                />
              </Field>
              <Field label={t('currency')}>
                <Input
                  maxLength={3}
                  value={draft.currency}
                  onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
                />
              </Field>
            </div>

            <Field label={t('note')}>
              <Input
                value={draft.note ?? ''}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              />
            </Field>

            <LocaleFields
              enabledLocales={enabledLocales}
              isFilled={(entry) => Boolean(draft.translations[entry]?.label?.trim())}
            >
              {(entry) => (
                <Field label={`${t('label')} · ${localeLabels[entry]}`}>
                  <Input
                    value={draft.translations[entry]?.label ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        translations: {
                          ...draft.translations,
                          [entry]: { label: event.target.value },
                        },
                      })
                    }
                  />
                </Field>
              )}
            </LocaleFields>

            <div className="flex gap-2">
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {tCommon('save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
