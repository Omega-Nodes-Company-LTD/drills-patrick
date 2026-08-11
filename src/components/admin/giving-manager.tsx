'use client'

import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  cancelInvoice,
  createInvoice,
  deleteAdoption,
  deletePledge,
  deleteSponsor,
  saveAdoption,
  savePledge,
  saveSponsor,
  updateRecurringPlan,
} from '@/app/actions/admin/giving'
import { MediaPicker } from '@/components/admin/media/media-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'
import { formatTaxRate } from '@/lib/giving/invoicing'

export type PledgeRow = {
  id: string
  campaignId: string | null
  matcherName: string
  matcherLogoId: string | null
  matcherUrl: string | null
  ratioBp: number
  ceiling: string
  ceilingMinor: number
  perDonationCap: string
  matchedMinor: number
  currency: string
  startsAt: string
  endsAt: string
  isActive: boolean
  note: string | null
}

export type SponsorRow = {
  id: string
  name: string
  logoId: string | null
  websiteUrl: string | null
  projectId: string | null
  campaignId: string | null
  tier: string | null
  legalName: string | null
  vatNumber: string | null
  country: string | null
  isPublished: boolean
  sortOrder: number
}

export type InvoiceRow = {
  id: string
  number: string
  issuedOn: string
  billToName: string
  netMinor: number
  taxMinor: number
  grossMinor: number
  taxRateBp: number
  currency: string
  voidedAt: string | null
}

export type UninvoicedRow = {
  id: string
  reference: string
  organisation: string
  email: string | null
  country: string | null
  amount: string
  amountMinor: number
  currency: string
}

export type AdoptionRow = {
  id: string
  projectId: string
  donorName: string
  donorEmail: string
  donorOrganisation: string | null
  startedOn: string
  endsOn: string | null
  amount: string
  currency: string
  updateEveryMonths: number
  lastUpdateSentAt: string | null
  isPublic: boolean
  isActive: boolean
}

export type PlanRow = {
  id: string
  reference: string
  donorName: string | null
  donorEmail: string
  amountMinor: number
  currency: string
  interval: string
  status: string
  nextChargeOn: string | null
}

type Options = {
  projects: { id: string; title: string }[]
  campaigns: { id: string; title: string }[]
  currencies: string[]
  defaultCurrency: string
}

export function GivingManager({
  pledges,
  sponsors,
  invoices,
  uninvoiced,
  adoptions,
  plans,
  options,
  locale,
  invoicingReady,
  storageEnabled,
}: {
  pledges: PledgeRow[]
  sponsors: SponsorRow[]
  invoices: InvoiceRow[]
  uninvoiced: UninvoicedRow[]
  adoptions: AdoptionRow[]
  plans: PlanRow[]
  options: Options
  locale: Locale
  invoicingReady: boolean
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.giving')

  return (
    <Tabs defaultValue="pledges" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="pledges">{t('pledges')}</TabsTrigger>
        <TabsTrigger value="sponsors">{t('sponsors')}</TabsTrigger>
        <TabsTrigger value="invoices">{t('invoices')}</TabsTrigger>
        <TabsTrigger value="adoptions">{t('adoptions')}</TabsTrigger>
        <TabsTrigger value="recurring">{t('recurring')}</TabsTrigger>
      </TabsList>

      <TabsContent value="pledges">
        <PledgesPanel rows={pledges} options={options} locale={locale} storageEnabled={storageEnabled} />
      </TabsContent>
      <TabsContent value="sponsors">
        <SponsorsPanel rows={sponsors} options={options} storageEnabled={storageEnabled} />
      </TabsContent>
      <TabsContent value="invoices">
        <InvoicesPanel
          rows={invoices}
          uninvoiced={uninvoiced}
          locale={locale}
          ready={invoicingReady}
        />
      </TabsContent>
      <TabsContent value="adoptions">
        <AdoptionsPanel rows={adoptions} options={options} />
      </TabsContent>
      <TabsContent value="recurring">
        <RecurringPanel rows={plans} locale={locale} />
      </TabsContent>
    </Tabs>
  )
}

// ------------------------------------------------------------------ pledges

function PledgesPanel({
  rows,
  options,
  locale,
  storageEnabled,
}: {
  rows: PledgeRow[]
  options: Options
  locale: Locale
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.giving')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<PledgeRow | null>(null)
  const [pending, startTransition] = useTransition()

  const empty = (): PledgeRow => ({
    id: '',
    campaignId: null,
    matcherName: '',
    matcherLogoId: null,
    matcherUrl: null,
    ratioBp: 10_000,
    ceiling: '',
    ceilingMinor: 0,
    perDonationCap: '',
    matchedMinor: 0,
    currency: options.defaultCurrency,
    startsAt: '',
    endsAt: '',
    isActive: true,
    note: null,
  })

  function save() {
    if (!draft) return

    startTransition(async () => {
      const result = await savePledge({
        ...draft,
        id: draft.id || undefined,
        perDonationCap: draft.perDonationCap || null,
      })

      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(result.error === 'bad_window' ? t('badWindow') : tCommon('error.generic'))
      }
    })
  }

  function remove(id: string) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return
    startTransition(async () => {
      const result = await deletePledge(id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t('pledges')}</CardTitle>
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
                    {row.matcherName} · {row.ratioBp / 10_000}×
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('matched')} {formatMoney(row.matchedMinor, row.currency, locale)} /{' '}
                    {formatMoney(row.ceilingMinor, row.currency, locale)} ·{' '}
                    {row.startsAt.slice(0, 10)} → {row.endsAt.slice(0, 10)}
                  </p>
                </div>
                {row.isActive ? <Badge>{t('active')}</Badge> : null}
                <Button size="iconSm" variant="ghost" onClick={() => setDraft(row)}>
                  {tCommon('edit')}
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(row.id)}
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
              <Field label={t('matcher')} htmlFor="matcherName" required>
                <Input
                  id="matcherName"
                  value={draft.matcherName}
                  onChange={(event) => setDraft({ ...draft, matcherName: event.target.value })}
                />
              </Field>
              <Field label={t('matcherUrl')} htmlFor="matcherUrl">
                <Input
                  id="matcherUrl"
                  value={draft.matcherUrl ?? ''}
                  onChange={(event) => setDraft({ ...draft, matcherUrl: event.target.value })}
                />
              </Field>
            </div>

            <MediaPicker
              label={t('logo')}
              storageEnabled={storageEnabled}
              value={draft.matcherLogoId}
              onChange={(value) => setDraft({ ...draft, matcherLogoId: value })}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('ratio')} htmlFor="ratioBp" hint={t('ratioHint')}>
                <Input
                  id="ratioBp"
                  type="number"
                  min={1}
                  value={draft.ratioBp}
                  onChange={(event) => setDraft({ ...draft, ratioBp: Number(event.target.value) })}
                />
              </Field>
              <Field label={t('ceiling')} htmlFor="ceiling" required>
                <Input
                  id="ceiling"
                  inputMode="decimal"
                  value={draft.ceiling}
                  onChange={(event) => setDraft({ ...draft, ceiling: event.target.value })}
                />
              </Field>
              <Field label={t('perDonationCap')} htmlFor="perDonationCap">
                <Input
                  id="perDonationCap"
                  inputMode="decimal"
                  value={draft.perDonationCap}
                  onChange={(event) => setDraft({ ...draft, perDonationCap: event.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={tCommon('language')} htmlFor="currency">
                <Select
                  id="currency"
                  value={draft.currency}
                  onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
                >
                  {options.currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('startsAt')} htmlFor="startsAt" required>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={draft.startsAt.slice(0, 16)}
                  onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
                />
              </Field>
              <Field label={t('endsAt')} htmlFor="endsAt" required>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={draft.endsAt.slice(0, 16)}
                  onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
                />
              </Field>
            </div>

            <Field label={t('campaign')} htmlFor="campaignId">
              <Select
                id="campaignId"
                value={draft.campaignId ?? ''}
                onChange={(event) => setDraft({ ...draft, campaignId: event.target.value || null })}
              >
                <option value="">—</option>
                {options.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                className="size-4 rounded border-border accent-[var(--color-primary)]"
              />
              {t('active')}
            </label>

            <Field label={tCommon('optional')} htmlFor="note">
              <Textarea
                id="note"
                rows={2}
                value={draft.note ?? ''}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              />
            </Field>

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

// ----------------------------------------------------------------- sponsors

function SponsorsPanel({
  rows,
  options,
  storageEnabled,
}: {
  rows: SponsorRow[]
  options: Options
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.giving')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<SponsorRow | null>(null)
  const [pending, startTransition] = useTransition()

  const empty = (): SponsorRow => ({
    id: '',
    name: '',
    logoId: null,
    websiteUrl: null,
    projectId: null,
    campaignId: null,
    tier: null,
    legalName: null,
    vatNumber: null,
    country: null,
    isPublished: false,
    sortOrder: rows.length,
  })

  function save() {
    if (!draft) return
    startTransition(async () => {
      const result = await saveSponsor({ ...draft, id: draft.id || undefined, addressLines: [] })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else toast.error(tCommon('error.generic'))
    })
  }

  function remove(id: string) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return
    startTransition(async () => {
      const result = await deleteSponsor(id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t('sponsors')}</CardTitle>
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
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.tier ?? '—'} · {row.country ?? '—'}
                  </p>
                </div>
                {row.isPublished ? <Badge>{t('published')}</Badge> : null}
                <Button size="iconSm" variant="ghost" onClick={() => setDraft(row)}>
                  {tCommon('edit')}
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(row.id)}
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
              <Field label={t('sponsorName')} htmlFor="name" required>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field label={t('tier')} htmlFor="tier">
                <Input
                  id="tier"
                  value={draft.tier ?? ''}
                  onChange={(event) => setDraft({ ...draft, tier: event.target.value })}
                />
              </Field>
              <Field label={t('legalName')} htmlFor="legalName">
                <Input
                  id="legalName"
                  value={draft.legalName ?? ''}
                  onChange={(event) => setDraft({ ...draft, legalName: event.target.value })}
                />
              </Field>
              <Field label={t('billToVat')} htmlFor="vatNumber">
                <Input
                  id="vatNumber"
                  value={draft.vatNumber ?? ''}
                  onChange={(event) => setDraft({ ...draft, vatNumber: event.target.value })}
                />
              </Field>
              <Field label={t('website')} htmlFor="websiteUrl">
                <Input
                  id="websiteUrl"
                  value={draft.websiteUrl ?? ''}
                  onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })}
                />
              </Field>
              <Field label={t('billToCountry')} htmlFor="country">
                <Input
                  id="country"
                  value={draft.country ?? ''}
                  onChange={(event) => setDraft({ ...draft, country: event.target.value })}
                />
              </Field>
            </div>

            <MediaPicker
              label={t('logo')}
              storageEnabled={storageEnabled}
              value={draft.logoId}
              onChange={(value) => setDraft({ ...draft, logoId: value })}
            />

            <Field label={t('project')} htmlFor="projectId">
              <Select
                id="projectId"
                value={draft.projectId ?? ''}
                onChange={(event) => setDraft({ ...draft, projectId: event.target.value || null })}
              >
                <option value="">—</option>
                {options.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })}
                className="size-4 rounded border-border accent-[var(--color-primary)]"
              />
              {t('published')}
            </label>

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

// ----------------------------------------------------------------- invoices

function InvoicesPanel({
  rows,
  uninvoiced,
  locale,
  ready,
}: {
  rows: InvoiceRow[]
  uninvoiced: UninvoicedRow[]
  locale: Locale
  ready: boolean
}) {
  const t = useTranslations('admin.giving')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<UninvoicedRow | null>(null)
  const [billTo, setBillTo] = useState({ name: '', vat: '', address: '', country: '' })
  const [pending, startTransition] = useTransition()

  // Refused rather than half-done: an invoice numbered by a guessed series is
  // a document someone has to explain to an inspector.
  if (!ready) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-sm text-muted-foreground">{t('notConfigured')}</p>
        </CardContent>
      </Card>
    )
  }

  function issue() {
    if (!draft) return

    startTransition(async () => {
      const result = await createInvoice({
        donationId: draft.id,
        billToName: billTo.name || draft.organisation,
        billToVat: billTo.vat,
        billToAddress: billTo.address,
        billToCountry: billTo.country || draft.country || '',
        amount: draft.amount,
        currency: draft.currency,
      })

      if (result.ok) {
        toast.success(result.data?.number ?? tCommon('success.saved'))
        setDraft(null)
        setBillTo({ name: '', vat: '', address: '', country: '' })
      } else {
        toast.error(result.error === 'not_configured' ? t('notConfigured') : tCommon('error.generic'))
      }
    })
  }

  function makeVoid(row: InvoiceRow) {
    const reason = window.prompt(t('voidReason'))
    if (!reason || reason.trim().length < 3) return

    startTransition(async () => {
      const result = await cancelInvoice({ id: row.id, reason })
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(result.error === 'already_void' ? t('alreadyVoid') : tCommon('error.generic'))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('uninvoiced')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {uninvoiced.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tAdmin('noItems')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {uninvoiced.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.organisation}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.reference} · {formatMoney(row.amountMinor, row.currency, locale)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft(row)
                      setBillTo({
                        name: row.organisation,
                        vat: '',
                        address: '',
                        country: row.country ?? '',
                      })
                    }}
                  >
                    {t('issueInvoice')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {draft ? (
            <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('billToName')} htmlFor="billToName" required>
                  <Input
                    id="billToName"
                    value={billTo.name}
                    onChange={(event) => setBillTo({ ...billTo, name: event.target.value })}
                  />
                </Field>
                <Field label={t('billToVat')} htmlFor="billToVat">
                  <Input
                    id="billToVat"
                    value={billTo.vat}
                    onChange={(event) => setBillTo({ ...billTo, vat: event.target.value })}
                  />
                </Field>
              </div>
              <Field label={t('billToAddress')} htmlFor="billToAddress">
                <Textarea
                  id="billToAddress"
                  rows={2}
                  value={billTo.address}
                  onChange={(event) => setBillTo({ ...billTo, address: event.target.value })}
                />
              </Field>
              <Field label={t('billToCountry')} htmlFor="billToCountry">
                <Input
                  id="billToCountry"
                  value={billTo.country}
                  onChange={(event) => setBillTo({ ...billTo, country: event.target.value })}
                />
              </Field>

              <div className="flex gap-2">
                <Button type="button" onClick={issue} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {t('issueInvoice')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                  {tCommon('cancel')}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('invoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tAdmin('noItems')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium">{row.number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.billToName} · {row.issuedOn} ·{' '}
                      {formatMoney(row.grossMinor, row.currency, locale)}
                      {row.taxRateBp > 0
                        ? ` (${formatTaxRate(row.taxRateBp)} ${formatMoney(row.taxMinor, row.currency, locale)})`
                        : ''}
                    </p>
                  </div>
                  {row.voidedAt ? (
                    <Badge variant="outline">{t('voided')}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => makeVoid(row)}
                      className="text-muted-foreground hover:text-danger"
                    >
                      {t('void')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- adoptions

function AdoptionsPanel({ rows, options }: { rows: AdoptionRow[]; options: Options }) {
  const t = useTranslations('admin.giving')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<AdoptionRow | null>(null)
  const [pending, startTransition] = useTransition()

  const empty = (): AdoptionRow => ({
    id: '',
    projectId: options.projects[0]?.id ?? '',
    donorName: '',
    donorEmail: '',
    donorOrganisation: null,
    startedOn: '',
    endsOn: null,
    amount: '0',
    currency: options.defaultCurrency,
    updateEveryMonths: 3,
    lastUpdateSentAt: null,
    isPublic: false,
    isActive: true,
  })

  function save() {
    if (!draft) return
    startTransition(async () => {
      const result = await saveAdoption({ ...draft, id: draft.id || undefined })
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else toast.error(tCommon('error.generic'))
    })
  }

  function remove(id: string) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return
    startTransition(async () => {
      const result = await deleteAdoption(id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t('adoptions')}</CardTitle>
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
                    {row.donorOrganisation || row.donorName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {options.projects.find((project) => project.id === row.projectId)?.title ?? '—'}{' '}
                    · {t('lastUpdate')}: {row.lastUpdateSentAt?.slice(0, 10) ?? t('never')}
                  </p>
                </div>
                <Button size="iconSm" variant="ghost" onClick={() => setDraft(row)}>
                  {tCommon('edit')}
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(row.id)}
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
            <Field label={t('project')} htmlFor="adoptionProject" required>
              <Select
                id="adoptionProject"
                value={draft.projectId}
                onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
              >
                {options.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('donor')} htmlFor="donorName" required>
                <Input
                  id="donorName"
                  value={draft.donorName}
                  onChange={(event) => setDraft({ ...draft, donorName: event.target.value })}
                />
              </Field>
              <Field label={t('donorEmail')} htmlFor="donorEmail" required>
                <Input
                  id="donorEmail"
                  type="email"
                  value={draft.donorEmail}
                  onChange={(event) => setDraft({ ...draft, donorEmail: event.target.value })}
                />
              </Field>
              <Field label={t('startedOn')} htmlFor="startedOn" required>
                <Input
                  id="startedOn"
                  type="date"
                  value={draft.startedOn}
                  onChange={(event) => setDraft({ ...draft, startedOn: event.target.value })}
                />
              </Field>
              <Field label={t('endsOn')} htmlFor="endsOn">
                <Input
                  id="endsOn"
                  type="date"
                  value={draft.endsOn ?? ''}
                  onChange={(event) => setDraft({ ...draft, endsOn: event.target.value || null })}
                />
              </Field>
              <Field label={t('amount')} htmlFor="adoptionAmount">
                <Input
                  id="adoptionAmount"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                />
              </Field>
              <Field label={t('updateEvery')} htmlFor="updateEveryMonths">
                <Input
                  id="updateEveryMonths"
                  type="number"
                  min={1}
                  max={24}
                  value={draft.updateEveryMonths}
                  onChange={(event) =>
                    setDraft({ ...draft, updateEveryMonths: Number(event.target.value) })
                  }
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isPublic}
                onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })}
                className="size-4 rounded border-border accent-[var(--color-primary)]"
              />
              {t('publicAdopter')}
            </label>

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

// ---------------------------------------------------------------- recurring

function RecurringPanel({ rows, locale }: { rows: PlanRow[]; locale: Locale }) {
  const t = useTranslations('admin.giving')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  function setStatus(row: PlanRow, status: string) {
    startTransition(async () => {
      const result = await updateRecurringPlan({
        id: row.id,
        status,
        nextChargeOn: row.nextChargeOn,
      })
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recurring')}</CardTitle>
      </CardHeader>
      <CardContent>
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
                    {row.donorName || row.donorEmail} ·{' '}
                    {formatMoney(row.amountMinor, row.currency, locale)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.reference} · {row.interval} · {t('nextCharge')}:{' '}
                    {row.nextChargeOn ?? '—'}
                  </p>
                </div>
                <Badge variant={row.status === 'active' ? 'default' : 'outline'}>{row.status}</Badge>
                {/*
                  Staff can stop a plan or resume one, but not change someone's
                  amount for them — that is the donor's own decision, and they
                  have a link for it.
                */}
                {row.status !== 'cancelled' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setStatus(row, row.status === 'paused' ? 'active' : 'paused')}
                  >
                    {row.status === 'paused' ? tCommon('open') : tCommon('close')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
