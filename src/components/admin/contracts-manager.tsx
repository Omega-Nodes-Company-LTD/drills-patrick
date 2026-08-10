'use client'

import { CalendarClock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteContract, saveContract } from '@/app/actions/admin/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { intlLocale, type Locale } from '@/i18n/config'

/**
 * Maintenance contracts, with the water points each one covers.
 *
 * The due date is the point of the screen: an overdue visit is the thing the
 * office needs to see without asking for it, so it is coloured rather than
 * buried in a column of dates.
 */

export type ContractRow = {
  id: string
  partnerId: string
  partnerName: string
  reference: string
  startsOn: string
  endsOn: string
  visitIntervalMonths: number
  fee: string
  currency: string
  responseHours: number
  isActive: boolean
  notes: string | null
  projectIds: string[]
  nextVisitDue: string
}

type Draft = Omit<ContractRow, 'id' | 'partnerName' | 'nextVisitDue'> & { id?: string }

export function ContractsManager({
  rows,
  partners,
  projects,
  locale,
}: {
  rows: ContractRow[]
  partners: { id: string; name: string }[]
  projects: { id: string; title: string }[]
  locale: Locale
}) {
  const t = useTranslations('admin.contracts')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  const today = new Date().toISOString().slice(0, 10)

  const emptyDraft = (): Draft => ({
    partnerId: partners[0]?.id ?? '',
    reference: '',
    startsOn: today,
    endsOn: today,
    visitIntervalMonths: 6,
    fee: '0',
    currency: 'UGX',
    responseHours: 72,
    isActive: true,
    notes: null,
    projectIds: [],
  })

  function remove(row: ContractRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteContract(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00Z`))

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        className="self-start"
        onClick={() => setDraft(emptyDraft())}
        disabled={partners.length === 0}
      >
        <Plus className="size-4" aria-hidden />
        {tAdmin('newItem')}
      </Button>

      {partners.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t('needPartner')}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {tAdmin('noItems')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const overdue = row.isActive && row.nextVisitDue < today

            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.partnerName} · {row.reference}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(row.startsOn)} — {formatDate(row.endsOn)} ·{' '}
                    {t('everyMonths', { count: row.visitIntervalMonths })}
                  </p>
                </div>

                <Badge variant={overdue ? 'danger' : row.isActive ? 'success' : 'outline'}>
                  <CalendarClock className="size-3.5" aria-hidden />
                  {formatDate(row.nextVisitDue)}
                </Badge>

                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      id: row.id,
                      partnerId: row.partnerId,
                      reference: row.reference,
                      startsOn: row.startsOn,
                      endsOn: row.endsOn,
                      visitIntervalMonths: row.visitIntervalMonths,
                      fee: row.fee,
                      currency: row.currency,
                      responseHours: row.responseHours,
                      isActive: row.isActive,
                      notes: row.notes,
                      projectIds: row.projectIds,
                    })
                  }
                  title={tCommon('edit')}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={() => remove(row)}
                  disabled={pending}
                  title={tCommon('delete')}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {draft ? (
        <ContractDialog
          draft={draft}
          setDraft={setDraft}
          partners={partners}
          projects={projects}
        />
      ) : null}
    </div>
  )
}

function ContractDialog({
  draft,
  setDraft,
  partners,
  projects,
}: {
  draft: Draft
  setDraft: (draft: Draft | null) => void
  partners: { id: string; name: string }[]
  projects: { id: string; title: string }[]
}) {
  const t = useTranslations('admin.contracts')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveContract(draft)
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(
          result.error === 'invalid_period' ? t('invalidPeriod') : tCommon('error.generic'),
        )
      }
    })
  }

  return (
    <Dialog open onOpenChange={(value) => !value && setDraft(null)}>
      <DialogContent closeLabel={tCommon('close')}>
        <DialogHeader>
          <DialogTitle>{draft.id ? tCommon('edit') : tAdmin('newItem')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('partner')} htmlFor="contract-partner" required>
              <Select
                id="contract-partner"
                value={draft.partnerId}
                onChange={(event) => setDraft({ ...draft, partnerId: event.target.value })}
              >
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('reference')} htmlFor="contract-reference" required>
              <Input
                id="contract-reference"
                value={draft.reference}
                onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
              />
            </Field>
            <Field label={t('startsOn')} htmlFor="contract-start" required>
              <Input
                id="contract-start"
                type="date"
                value={draft.startsOn}
                onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })}
              />
            </Field>
            <Field label={t('endsOn')} htmlFor="contract-end" required>
              <Input
                id="contract-end"
                type="date"
                value={draft.endsOn}
                onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })}
              />
            </Field>
            <Field label={t('interval')} htmlFor="contract-interval">
              <Input
                id="contract-interval"
                type="number"
                min={1}
                value={draft.visitIntervalMonths}
                onChange={(event) =>
                  setDraft({ ...draft, visitIntervalMonths: Number(event.target.value) })
                }
              />
            </Field>
            <Field label={t('responseHours')} htmlFor="contract-response">
              <Input
                id="contract-response"
                type="number"
                min={1}
                value={draft.responseHours}
                onChange={(event) =>
                  setDraft({ ...draft, responseHours: Number(event.target.value) })
                }
              />
            </Field>
            <Field label={t('fee')} htmlFor="contract-fee">
              <Input
                id="contract-fee"
                inputMode="decimal"
                value={draft.fee}
                onChange={(event) => setDraft({ ...draft, fee: event.target.value })}
              />
            </Field>
            <Field label={t('currency')} htmlFor="contract-currency">
              <Input
                id="contract-currency"
                maxLength={3}
                value={draft.currency}
                onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
              />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('coveredProjects')}</legend>
            <div className="max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-border p-3">
              {projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.projectIds.includes(project.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        projectIds: event.target.checked
                          ? [...draft.projectIds, project.id]
                          : draft.projectIds.filter((id) => id !== project.id),
                      })
                    }
                  />
                  {project.title}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label={t('notes')} htmlFor="contract-notes">
            <Textarea
              id="contract-notes"
              rows={2}
              value={draft.notes ?? ''}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </Field>

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('active')}</span>
            <Switch
              checked={draft.isActive}
              onCheckedChange={(isActive) => setDraft({ ...draft, isActive })}
            />
          </label>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={pending || !draft.reference.trim() || !draft.partnerId}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
