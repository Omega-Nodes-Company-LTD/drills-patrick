'use client'

import { Calculator, Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createQuote,
  deleteDrillingRate,
  saveDrillingRate,
} from '@/app/actions/admin/quotes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { formatMoney } from '@/lib/money'
import type { Locale } from '@/i18n/config'

/**
 * The rate table and the quote built from it, side by side.
 *
 * They belong on one screen because the estimate is only as good as the rates
 * behind it: an operator who sees a number they do not believe needs the row
 * that produced it within reach.
 */

export type RateRow = {
  id: string
  label: string
  depthFromM: number
  depthToM: number
  geology: string
  ratePerMetreMinor: number
  fixedCostMinor: number
  currency: string
  isActive: boolean
  sortOrder: number
}

export type QuoteSummary = {
  id: string
  reference: string
  organisationName: string
  depthM: number
  wellsCount: number
  totalMinor: number
  currency: string
  status: string
  createdAt: string
}

export function QuotesManager({
  rates,
  quotes,
  locale,
}: {
  rates: RateRow[]
  quotes: QuoteSummary[]
  locale: Locale
}) {
  const t = useTranslations('admin.quotes')

  // The geologies offered in the quote form are exactly those the rate table
  // knows about, so a quote can never ask for a rate that cannot exist.
  const geologies = useMemo(() => {
    const set = new Set(rates.filter((rate) => rate.isActive).map((rate) => rate.geology))
    set.add('any')
    return [...set].sort()
  }, [rates])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('rates')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RateTable rows={rates} locale={locale} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('issued')}</CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noQuotes')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {quotes.map((quote) => (
                  <li
                    key={quote.id}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{quote.organisationName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {quote.reference} · {quote.wellsCount} × {quote.depthM} m
                      </p>
                    </div>
                    <Badge variant="outline">{t(`statuses.${quote.status}`)}</Badge>
                    <span className="font-semibold">
                      {formatMoney(quote.totalMinor, quote.currency, locale, {
                        hideDecimals: true,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <QuoteBuilder geologies={geologies} />
    </div>
  )
}

function RateTable({ rows, locale }: { rows: RateRow[]; locale: Locale }) {
  const t = useTranslations('admin.quotes')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Partial<RateRow> | null>(null)

  function save(values: Partial<RateRow> & { ratePerMetre?: string; fixedCost?: string }) {
    startTransition(async () => {
      const result = await saveDrillingRate(values)
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(result.error === 'invalid_band' ? t('invalidBand') : tCommon('error.generic'))
      }
    })
  }

  function remove(row: RateRow) {
    startTransition(async () => {
      const result = await deleteDrillingRate(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start">
                <th className="py-2 text-start font-medium">{t('band')}</th>
                <th className="py-2 text-start font-medium">{t('geology')}</th>
                <th className="py-2 text-end font-medium">{t('perMetre')}</th>
                <th className="py-2 text-end font-medium">{t('fixed')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    {row.label}
                    <span className="block text-xs text-muted-foreground">
                      {row.depthFromM}–{row.depthToM} m
                    </span>
                  </td>
                  <td className="py-2">
                    <Badge variant={row.isActive ? 'outline' : 'default'}>{row.geology}</Badge>
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {formatMoney(row.ratePerMetreMinor, row.currency, locale, {
                      hideDecimals: true,
                    })}
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {formatMoney(row.fixedCostMinor, row.currency, locale, { hideDecimals: true })}
                  </td>
                  <td className="py-2 text-end">
                    <Button
                      size="iconSm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(row)}
                      title={tCommon('delete')}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('noRates')}</p>
      )}

      {draft ? (
        <form
          className="grid gap-3 rounded-[var(--radius-md)] border border-border p-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            save(Object.fromEntries(new FormData(event.currentTarget)) as never)
          }}
        >
          <Field label={t('label')}>
            <Input name="label" required />
          </Field>
          <Field label={t('geology')} hint={t('geologyHint')}>
            <Input name="geology" defaultValue="any" />
          </Field>
          <Field label={t('depthFrom')}>
            <Input name="depthFromM" type="number" min={0} defaultValue={0} />
          </Field>
          <Field label={t('depthTo')}>
            <Input name="depthToM" type="number" min={1} defaultValue={60} />
          </Field>
          <Field label={t('perMetre')}>
            <Input name="ratePerMetre" inputMode="decimal" defaultValue="0" />
          </Field>
          <Field label={t('fixed')}>
            <Input name="fixedCost" inputMode="decimal" defaultValue="0" />
          </Field>
          <Field label={t('currency')}>
            <Input name="currency" maxLength={3} defaultValue="UGX" />
          </Field>
          <input type="hidden" name="isActive" value="true" />

          <div className="flex items-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {tCommon('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              {tCommon('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" className="self-start" onClick={() => setDraft({})}>
          <Plus className="size-4" aria-hidden />
          {t('addRate')}
        </Button>
      )}
    </div>
  )
}

function QuoteBuilder({ geologies }: { geologies: string[] }) {
  const t = useTranslations('admin.quotes')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  return (
    <Card className="h-fit lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="size-4 text-primary" aria-hidden />
          {t('newQuote')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const values = Object.fromEntries(new FormData(form))

            startTransition(async () => {
              const result = await createQuote(values)
              if (result.ok) {
                toast.success(tCommon('success.created'))
                form.reset()
              } else {
                toast.error(result.error === 'no_rate' ? t('noRateFor') : tCommon('error.generic'))
              }
            })
          }}
        >
          <Field label={t('organisation')} required>
            <Input name="organisationName" required />
          </Field>
          <Field label={t('contact')}>
            <Input name="contactName" />
          </Field>
          <Field label={t('email')}>
            <Input name="contactEmail" type="email" />
          </Field>
          <Field label={t('district')}>
            <Input name="district" />
          </Field>
          <Field label={t('geology')}>
            <Select name="geology" defaultValue="any">
              {geologies.map((geology) => (
                <option key={geology} value={geology}>
                  {geology}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('depth')}>
              <Input name="depthM" type="number" min={1} defaultValue={60} required />
            </Field>
            <Field label={t('wells')}>
              <Input name="wellsCount" type="number" min={1} defaultValue={1} required />
            </Field>
          </div>
          <Field label={t('validUntil')}>
            <Input name="validUntil" type="date" />
          </Field>
          <Field label={t('notes')}>
            <Textarea name="notes" rows={2} />
          </Field>

          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('issue')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
