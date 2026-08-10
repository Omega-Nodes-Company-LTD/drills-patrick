'use client'

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteUser, saveUser } from '@/app/actions/admin/users'
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
import { Field, Input, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { intlLocale, locales, localeLabels, type Locale } from '@/i18n/config'

export type UserRowView = {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'finance'
  locale: Locale
  isActive: boolean
  lastLoginAt: string | null
}

export function UsersManager({
  rows,
  locale,
  currentUserId,
}: {
  rows: UserRowView[]
  locale: Locale
  currentUserId: string
}) {
  const t = useTranslations('admin.users')
  const tCommon = useTranslations('common')
  const [editing, setEditing] = useState<UserRowView | null>(null)
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove(row: UserRowView) {
    if (!window.confirm(tCommon('delete'))) return

    startTransition(async () => {
      const result = await deleteUser(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else
        toast.error(
          result.error === 'self'
            ? t('cannotDeleteSelf')
            : result.error === 'last_admin'
              ? t('lastAdmin')
              : tCommon('error.generic'),
        )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={() => setCreating(true)} className="self-start">
        <Plus className="size-4" aria-hidden />
        {t('invite')}
      </Button>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 md:flex-row md:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
            </div>

            <Badge variant={row.role === 'admin' ? 'primary' : 'outline'}>
              {t(`roles.${row.role}`)}
            </Badge>

            {!row.isActive ? <Badge variant="danger">{t('active')}: {tCommon('no')}</Badge> : null}

            <span className="shrink-0 text-xs text-muted-foreground">
              {row.lastLoginAt
                ? new Intl.DateTimeFormat(intlLocale(locale), {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(row.lastLoginAt))
                : '—'}
            </span>

            <div className="flex shrink-0 gap-1">
              <Button size="iconSm" variant="ghost" onClick={() => setEditing(row)} title={tCommon('edit')}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              {row.id !== currentUserId ? (
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
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <UserDialog
        open={creating || Boolean(editing)}
        user={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function UserDialog({
  open,
  user,
  onClose,
}: {
  open: boolean
  user: UserRowView | null
  onClose: () => void
}) {
  const t = useTranslations('admin.users')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(user?.isActive ?? true)

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
        else setIsActive(user?.isActive ?? true)
      }}
    >
      <DialogContent closeLabel={tCommon('close')}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const data = Object.fromEntries(new FormData(event.currentTarget))

            startTransition(async () => {
              const result = await saveUser({
                id: user?.id,
                name: data.name,
                email: data.email,
                role: data.role,
                locale: data.locale,
                isActive,
                password: data.password || undefined,
              })

              if (result.ok) {
                toast.success(tCommon('success.saved'))
                onClose()
              } else {
                toast.error(
                  result.error === 'last_admin'
                    ? t('lastAdmin')
                    : result.error === 'weak_password'
                      ? t('passwordHint')
                      : tCommon('error.generic'),
                )
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{user ? user.name : t('invite')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <Field label={t('name')} htmlFor="u-name" required>
              <Input id="u-name" name="name" defaultValue={user?.name} required />
            </Field>

            <Field label={t('email')} htmlFor="u-email" required>
              <Input id="u-email" name="email" type="email" defaultValue={user?.email} required />
            </Field>

            <Field
              label={user ? t('newPassword') : t('password')}
              htmlFor="u-password"
              hint={t('passwordHint')}
              required={!user}
            >
              <Input
                id="u-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!user}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('role')} htmlFor="u-role">
                <Select id="u-role" name="role" defaultValue={user?.role ?? 'editor'}>
                  {(['admin', 'editor', 'finance'] as const).map((role) => (
                    <option key={role} value={role}>
                      {t(`roles.${role}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={tCommon('language')} htmlFor="u-locale">
                <Select id="u-locale" name="locale" defaultValue={user?.locale ?? 'en'}>
                  {locales.map((entry) => (
                    <option key={entry} value={entry}>
                      {localeLabels[entry]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              {t('active')}
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
