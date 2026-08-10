'use client'

import { Check, ChevronDown, Mail, Trash2, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteContactSubmission,
  deleteSubscriber,
  setContactHandled,
} from '@/app/actions/admin/messages'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { intlLocale, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

export type ContactRow = {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  locale: string
  isHandled: boolean
  createdAt: string
}

export type SubscriberRow = {
  id: string
  email: string
  name: string | null
  locale: string
  isConfirmed: boolean
  unsubscribedAt: string | null
  createdAt: string
}

export function MessagesPanel({
  locale,
  contacts,
  subscribers,
}: {
  locale: Locale
  contacts: ContactRow[]
  subscribers: SubscriberRow[]
}) {
  const t = useTranslations('admin.messages')

  return (
    <Tabs defaultValue="contacts" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="contacts">
          {t('contacts')} ({contacts.length})
        </TabsTrigger>
        <TabsTrigger value="subscribers">
          {t('subscribers')} ({subscribers.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="contacts">
        <ContactsList rows={contacts} locale={locale} />
      </TabsContent>

      <TabsContent value="subscribers">
        <SubscribersList rows={subscribers} locale={locale} />
      </TabsContent>
    </Tabs>
  )
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function ContactsList({ rows, locale }: { rows: ContactRow[]; locale: Locale }) {
  const t = useTranslations('admin.messages')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {tAdmin('noItems')}
      </p>
    )
  }

  function toggleHandled(row: ContactRow) {
    startTransition(async () => {
      const result = await setContactHandled(row.id, !row.isHandled)
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  function remove(row: ContactRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteContactSubmission(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
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
                <p className="truncate font-medium">{row.subject || row.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.name} · {row.email}
                </p>
              </div>
              <Badge variant={row.isHandled ? 'success' : 'primary'} className="shrink-0">
                {row.isHandled ? t('handled') : t('new')}
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(row.createdAt, locale)}
              </span>
            </button>

            {open ? (
              <div className="flex flex-col gap-4 border-t border-border p-4">
                <p className="whitespace-pre-wrap rounded-[var(--radius-md)] bg-muted p-3 text-sm">
                  {row.message}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={`mailto:${row.email}`}>
                      <Mail className="size-4" aria-hidden />
                      {t('reply')}
                    </a>
                  </Button>
                  {row.phone ? (
                    <Button asChild variant="ghost" size="sm">
                      <a href={`tel:${row.phone}`}>{row.phone}</a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleHandled(row)}
                  >
                    {row.isHandled ? (
                      <Undo2 className="size-4" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    {row.isHandled ? t('reopen') : t('markHandled')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(row)}
                    className="ms-auto text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {tCommon('delete')}
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function SubscribersList({ rows, locale }: { rows: SubscriberRow[]; locale: Locale }) {
  const t = useTranslations('admin.messages')
  const tAdmin = useTranslations('admin.common')
  const tCommon = useTranslations('common')
  const [pending, startTransition] = useTransition()

  function remove(row: SubscriberRow) {
    if (!window.confirm(`${tAdmin('confirmDelete')} ${tAdmin('confirmDeleteText')}`)) return

    startTransition(async () => {
      const result = await deleteSubscriber(row.id)
      if (result.ok) toast.success(tCommon('success.deleted'))
      else toast.error(tCommon('error.generic'))
    })
  }

  function exportCsv() {
    const header = ['email', 'name', 'locale', 'confirmed', 'unsubscribed_at', 'created_at']
    const lines = rows.map((row) =>
      [
        row.email,
        row.name ?? '',
        row.locale,
        row.isConfirmed ? 'yes' : 'no',
        row.unsubscribedAt ?? '',
        row.createdAt,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )

    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {tAdmin('noItems')}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', pending && 'opacity-70')}>
      <Button type="button" variant="outline" onClick={exportCsv} className="self-start">
        {tAdmin('export')}
      </Button>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[row.name, row.locale, formatDate(row.createdAt, locale)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            {row.unsubscribedAt ? (
              <Badge variant="danger">{t('unsubscribed')}</Badge>
            ) : row.isConfirmed ? (
              <Badge variant="success">{t('confirmed')}</Badge>
            ) : (
              <Badge variant="outline">{t('pending')}</Badge>
            )}

            <Button
              size="iconSm"
              variant="ghost"
              onClick={() => remove(row)}
              title={tCommon('delete')}
              className="text-muted-foreground hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
