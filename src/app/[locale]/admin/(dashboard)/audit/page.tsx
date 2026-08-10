import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { Badge } from '@/components/ui/badge'
import { intlLocale, type Locale } from '@/i18n/config'
import { listAuditEntries } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('settings')

  const [t, entries] = await Promise.all([getTranslations('admin.audit'), listAuditEntries(200)])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} />

      {entries.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge variant="outline">{entry.action}</Badge>
              <span className="text-muted-foreground">{entry.entityType}</span>
              {entry.summary ? <span className="min-w-0 truncate">{entry.summary}</span> : null}
              <span className="ms-auto text-xs text-muted-foreground">
                {entry.actorName ?? entry.actorEmail ?? '—'} ·{' '}
                {new Intl.DateTimeFormat(intlLocale(locale), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
