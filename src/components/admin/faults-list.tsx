'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateFault } from '@/app/actions/admin/faults'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/field'
import { intlLocale, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

export type FaultRow = {
  id: string
  reference: string
  projectTitle: string
  description: string
  symptom: string | null
  status: 'reported' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed'
  reporterName: string | null
  reporterPhone: string | null
  resolutionNote: string | null
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

const STATUSES = ['reported', 'acknowledged', 'in_progress', 'resolved', 'closed'] as const

const statusVariant: Record<FaultRow['status'], 'danger' | 'warning' | 'success' | 'default'> = {
  reported: 'danger',
  acknowledged: 'warning',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
}

export function FaultsList({ rows, locale }: { rows: FaultRow[]; locale: Locale }) {
  const t = useTranslations('admin.faults')
  const tCommon = useTranslations('common')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {t('empty')}
      </p>
    )
  }

  function save(row: FaultRow, status: FaultRow['status'], note: string) {
    startTransition(async () => {
      const result = await updateFault({ id: row.id, status, resolutionNote: note })
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))

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
                <p className="truncate font-medium">{row.projectTitle}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.reference}
                  {row.symptom ? ` · ${row.symptom}` : ''}
                </p>
              </div>
              <Badge variant={statusVariant[row.status]} className="shrink-0">
                {t(`statuses.${row.status}`)}
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(row.createdAt)}
              </span>
            </button>

            {open ? (
              <div className="flex flex-col gap-4 border-t border-border p-4">
                <p className="whitespace-pre-wrap rounded-[var(--radius-md)] bg-muted p-3 text-sm">
                  {row.description}
                </p>

                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  {[
                    [t('reporter'), row.reporterName],
                    [t('phone'), row.reporterPhone],
                    [t('acknowledged'), row.acknowledgedAt ? formatDate(row.acknowledgedAt) : null],
                    [t('resolved'), row.resolvedAt ? formatDate(row.resolvedAt) : null],
                  ]
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{String(value)}</dd>
                      </div>
                    ))}
                </dl>

                <FaultControls row={row} onSave={save} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function FaultControls({
  row,
  onSave,
}: {
  row: FaultRow
  onSave: (row: FaultRow, status: FaultRow['status'], note: string) => void
}) {
  const t = useTranslations('admin.faults')
  const tCommon = useTranslations('common')
  const [status, setStatus] = useState(row.status)
  const [note, setNote] = useState(row.resolutionNote ?? '')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        {t('resolutionNote')}
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm sm:w-48">
        {t('status')}
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
