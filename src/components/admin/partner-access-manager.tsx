'use client'

import { KeyRound, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deletePartnerContact,
  savePartnerContact,
  setPartnerProjects,
} from '@/app/actions/admin/partner-access'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { locales, localeLabels, type Locale } from '@/i18n/config'

/**
 * Partner accounts and what they can see.
 *
 * There is no self-registration anywhere: access to another organisation's
 * borehole records is granted here by a named admin or not at all.
 */

export type ContactRow = {
  id: string
  partnerId: string
  partnerName: string
  email: string
  name: string
  role: string | null
  phone: string | null
  locale: Locale
  reportFrequency: 'none' | 'monthly' | 'quarterly'
  isActive: boolean
  lastLoginAt: string | null
}

type Draft = Omit<ContactRow, 'id' | 'partnerName' | 'lastLoginAt'> & {
  id?: string
  password?: string
}

export function PartnerAccessManager({
  contacts,
  partners,
  projects,
  partnerProjects,
}: {
  contacts: ContactRow[]
  partners: { id: string; name: string }[]
  projects: { id: string; title: string }[]
  partnerProjects: { partnerId: string; projectId: string }[]
}) {
  const t = useTranslations('admin.partnerAccess')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(row: ContactRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deletePartnerContact(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  const emptyDraft = (): Draft => ({
    partnerId: partners[0]?.id ?? '',
    email: '',
    name: '',
    role: null,
    phone: null,
    locale: 'en',
    reportFrequency: 'none',
    isActive: true,
    password: '',
  })

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{t('accounts')}</CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => setDraft(emptyDraft())}
            disabled={partners.length === 0}
          >
            <Plus className="size-4" aria-hidden />
            {tAdmin('newItem')}
          </Button>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('needPartner')}</p>
          ) : contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{tAdmin('noItems')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {contacts.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.name} · {row.partnerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.email}
                      {row.lastLoginAt ? ` · ${row.lastLoginAt.slice(0, 10)}` : ` · ${t('never')}`}
                    </p>
                  </div>

                  {row.reportFrequency !== 'none' ? (
                    <Badge variant="primary">{t(`frequency.${row.reportFrequency}`)}</Badge>
                  ) : null}
                  <Badge variant={row.isActive ? 'success' : 'outline'}>
                    {row.isActive ? t('active') : t('disabled')}
                  </Badge>

                  <Button
                    size="iconSm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        partnerId: row.partnerId,
                        email: row.email,
                        name: row.name,
                        role: row.role,
                        phone: row.phone,
                        locale: row.locale,
                        reportFrequency: row.reportFrequency,
                        isActive: row.isActive,
                        password: '',
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {partners.map((partner) => (
        <PartnerProjectPicker
          key={partner.id}
          partner={partner}
          projects={projects}
          selected={partnerProjects
            .filter((link) => link.partnerId === partner.id)
            .map((link) => link.projectId)}
        />
      ))}

      {draft ? <ContactDialog draft={draft} setDraft={setDraft} partners={partners} /> : null}
    </div>
  )
}

function PartnerProjectPicker({
  partner,
  projects,
  selected,
}: {
  partner: { id: string; name: string }
  projects: { id: string; title: string }[]
  selected: string[]
}) {
  const t = useTranslations('admin.partnerAccess')
  const tCommon = useTranslations('common')
  const [ids, setIds] = useState<string[]>(selected)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('visibleTo', { name: partner.name })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-border p-3">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
          ) : (
            projects.map((project) => (
              <label key={project.id} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={ids.includes(project.id)}
                  onChange={(event) =>
                    setIds(
                      event.target.checked
                        ? [...ids, project.id]
                        : ids.filter((id) => id !== project.id),
                    )
                  }
                />
                {project.title}
              </label>
            ))
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setPartnerProjects({ partnerId: partner.id, projectIds: ids })
              if (result.ok) toast.success(tCommon('success.saved'))
              else toast.error(tCommon('error.generic'))
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {tCommon('save')}
        </Button>
      </CardContent>
    </Card>
  )
}

function ContactDialog({
  draft,
  setDraft,
  partners,
}: {
  draft: Draft
  setDraft: (draft: Draft | null) => void
  partners: { id: string; name: string }[]
}) {
  const t = useTranslations('admin.partnerAccess')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await savePartnerContact(draft)
      if (result.ok) {
        toast.success(tCommon('success.saved'))
        setDraft(null)
      } else {
        toast.error(
          result.error === 'weak_password'
            ? t('weakPassword')
            : result.error === 'password_required'
              ? t('passwordRequired')
              : tCommon('error.generic'),
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
          <Field label={t('partner')} htmlFor="pc-partner" required>
            <Select
              id="pc-partner"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('name')} htmlFor="pc-name" required>
              <Input
                id="pc-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label={t('email')} htmlFor="pc-email" required>
              <Input
                id="pc-email"
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
            </Field>
            <Field label={t('role')} htmlFor="pc-role">
              <Input
                id="pc-role"
                value={draft.role ?? ''}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
              />
            </Field>
            <Field label={t('phone')} htmlFor="pc-phone">
              <Input
                id="pc-phone"
                value={draft.phone ?? ''}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              />
            </Field>
            <Field label={t('language')} htmlFor="pc-locale">
              <Select
                id="pc-locale"
                value={draft.locale}
                onChange={(event) => setDraft({ ...draft, locale: event.target.value as Locale })}
              >
                {locales.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeLabels[locale]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('reports')} htmlFor="pc-reports">
              <Select
                id="pc-reports"
                value={draft.reportFrequency}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    reportFrequency: event.target.value as Draft['reportFrequency'],
                  })
                }
              >
                <option value="none">{t('frequency.none')}</option>
                <option value="monthly">{t('frequency.monthly')}</option>
                <option value="quarterly">{t('frequency.quarterly')}</option>
              </Select>
            </Field>
          </div>

          <Field
            label={t('password')}
            htmlFor="pc-password"
            hint={draft.id ? t('passwordHintEdit') : t('passwordHintNew')}
          >
            <Input
              id="pc-password"
              type="password"
              autoComplete="new-password"
              value={draft.password ?? ''}
              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
            />
          </Field>

          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" aria-hidden />
              {t('active')}
            </span>
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
            disabled={pending || !draft.name.trim() || !draft.email.trim()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
