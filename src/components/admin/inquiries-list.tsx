'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateInquiry } from '@/app/actions/admin/inquiries'
import { Badge } from '@/components/ui/badge'
import { Select, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { intlLocale, type Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export type InquiryRow = {
  id: string
  organisationName: string
  contactName: string
  email: string
  phone: string | null
  country: string | null
  region: string | null
  interventionType: string | null
  wellsRequested: number | null
  beneficiariesEstimate: number | null
  budgetMinor: number | null
  currency: string | null
  timeframe: string | null
  message: string
  status: 'new' | 'in_review' | 'quoted' | 'won' | 'lost' | 'archived'
  adminNote: string | null
  createdAt: string
}

const STATUSES = ['new', 'in_review', 'quoted', 'won', 'lost', 'archived'] as const

const statusVariant: Record<InquiryRow['status'], 'primary' | 'warning' | 'success' | 'danger' | 'default'> = {
  new: 'primary',
  in_review: 'warning',
  quoted: 'warning',
  won: 'success',
  lost: 'danger',
  archived: 'default',
}

export function InquiriesList({ rows, locale }: { rows: InquiryRow[]; locale: Locale }) {
  const t = useTranslations('admin.inquiries')
  const tCommon = useTranslations('common')
  const tProjects = useTranslations('projects.type')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {t('empty')}
      </p>
    )
  }

  function save(row: InquiryRow, status: InquiryRow['status'], adminNote: string) {
    startTransition(async () => {
      const result = await updateInquiry({ id: row.id, status, adminNote })
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <ul className={cn('flex flex-col gap-2', pending && 'opacity-70')}>
      {rows.map((row) => {
        const open = openId === row.id

        return (
          <li key={row.id} className="rounded-[var(--radius-lg)] border border-border bg-surface">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : row.id)}
              aria-expanded={open}
              className="flex w-full flex-col gap-2 p-4 text-start md:flex-row md:items-center md:gap-4"
            >
              <ChevronDown
                className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.organisationName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.contactName} · {row.email}
                  {row.country ? ` · ${row.country}` : ''}
                </p>
              </div>
              <Badge variant={statusVariant[row.status]} className="shrink-0">
                {t(`statuses.${row.status}`)}
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(intlLocale(locale), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(row.createdAt))}
              </span>
            </button>

            {open ? (
              <div className="flex flex-col gap-4 border-t border-border p-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    [t('intervention'), row.interventionType ? tProjects(row.interventionType) : null],
                    ['Region', row.region],
                    ['Phone', row.phone],
                    ['Water points', row.wellsRequested],
                    ['Beneficiaries', row.beneficiariesEstimate],
                    [
                      'Budget',
                      row.budgetMinor != null && row.currency
                        ? formatMoney(row.budgetMinor, row.currency, locale, { hideDecimals: true })
                        : null,
                    ],
                    ['Timeframe', row.timeframe],
                  ]
                    .filter(([, value]) => value !== null && value !== undefined && value !== '')
                    .map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{String(value)}</dd>
                      </div>
                    ))}
                </dl>

                {row.message ? (
                  <p className="whitespace-pre-wrap rounded-[var(--radius-md)] bg-muted p-3 text-sm">
                    {row.message}
                  </p>
                ) : null}

                <InquiryControls row={row} onSave={save} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function InquiryControls({
  row,
  onSave,
}: {
  row: InquiryRow
  onSave: (row: InquiryRow, status: InquiryRow['status'], note: string) => void
}) {
  const t = useTranslations('admin.inquiries')
  const tDonations = useTranslations('admin.donations')
  const tCommon = useTranslations('common')
  const [status, setStatus] = useState(row.status)
  const [note, setNote] = useState(row.adminNote ?? '')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        {tDonations('adminNote')}
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm sm:w-48">
        {t('statuses.new')}
        <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`statuses.${value}`)}
            </option>
          ))}
        </Select>
      </label>

      <Button type="button" onClick={() => onSave(row, status, note)}>
        {tCommon('save')}
      </Button>
    </div>
  )
}
