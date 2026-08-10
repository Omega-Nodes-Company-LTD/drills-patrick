import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  HandCoins,
  Mailbox,
  Megaphone,
  Users,
  XCircle,
} from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { features } from '@/env'
import { intlLocale, type Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import { listAuditEntries } from '@/lib/audit'
import { requireUser } from '@/lib/auth/guard'
import { can } from '@/lib/auth/session'
import { dashboardStats, recentDonations } from '@/lib/admin/stats'
import { formatMoney, formatNumber } from '@/lib/money'
import { providerStatuses } from '@/lib/payments/registry'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ denied?: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const user = await requireUser()
  const { denied } = await searchParams
  const t = await getTranslations('admin.dashboard')
  const tDonations = await getTranslations('admin.donations')

  const [stats, donations, audit] = await Promise.all([
    dashboardStats(),
    can(user, 'donations') ? recentDonations() : Promise.resolve([]),
    can(user, 'settings') ? listAuditEntries(8) : Promise.resolve([]),
  ])

  const tiles = [
    {
      label: t('raisedThisMonth'),
      value: formatMoney(stats.raisedThisMonth, stats.currency, locale, { hideDecimals: true }),
      icon: HandCoins,
      show: can(user, 'donations'),
    },
    {
      label: t('raisedTotal'),
      value: formatMoney(stats.raisedTotal, stats.currency, locale, { hideDecimals: true }),
      icon: HandCoins,
      show: can(user, 'donations'),
    },
    {
      label: t('pendingDonations'),
      value: formatNumber(stats.pendingDonations, locale),
      icon: AlertTriangle,
      show: can(user, 'donations'),
      href: '/admin/donations?status=pending',
    },
    {
      label: t('activeCampaigns'),
      value: formatNumber(stats.activeCampaigns, locale),
      icon: Megaphone,
      show: true,
      href: '/admin/campaigns',
    },
    {
      label: t('projectsCompleted'),
      value: formatNumber(stats.projectsCompleted, locale),
      icon: CheckCircle2,
      show: true,
      href: '/admin/projects?status=completed',
    },
    {
      label: t('projectsInProgress'),
      value: formatNumber(stats.projectsInProgress, locale),
      icon: Droplets,
      show: true,
      href: '/admin/projects?status=in_progress',
    },
    {
      label: t('beneficiaries'),
      value: formatNumber(stats.beneficiaries, locale, true),
      icon: Users,
      show: true,
    },
    {
      label: t('newInquiries'),
      value: formatNumber(stats.newInquiries, locale),
      icon: Mailbox,
      show: can(user, 'inquiries'),
      href: '/admin/inquiries',
    },
  ].filter((tile) => tile.show)

  const integrations = [
    ...providerStatuses().map((entry) => ({ name: entry.id, configured: entry.configured })),
    { name: 'storage (S3)', configured: features.storage },
    { name: 'embeddings', configured: features.embeddings },
    { name: 'chat assistant', configured: features.ragChat },
    { name: 'email (SMTP)', configured: features.mail },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('welcome', { name: user.name })}</p>
      </div>

      {denied ? (
        <p className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3 text-sm">
          {t('permissionDenied')}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const content = (
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{tile.label}</p>
                  <p className="mt-1 font-heading text-heading font-bold">{tile.value}</p>
                </div>
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              </CardContent>
            </Card>
          )

          return tile.href ? (
            <Link key={tile.label} href={tile.href}>
              {content}
            </Link>
          ) : (
            <div key={tile.label}>{content}</div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {can(user, 'donations') ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('recentDonations')}</CardTitle>
            </CardHeader>
            <CardContent>
              {donations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noData')}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {donations.map((donation) => (
                    <li key={donation.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {donation.isAnonymous
                            ? tDonations('anonymous')
                            : donation.donorOrganisation || donation.donorName || donation.reference}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {donation.provider} ·{' '}
                          {new Intl.DateTimeFormat(intlLocale(locale), {
                            day: 'numeric',
                            month: 'short',
                          }).format(donation.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">
                          {formatMoney(donation.amountMinor, donation.currency, locale, {
                            hideDecimals: true,
                          })}
                        </span>
                        <Badge
                          variant={
                            donation.status === 'succeeded'
                              ? 'success'
                              : donation.status === 'failed' || donation.status === 'cancelled'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {tDonations(`statuses.${donation.status}`)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('integrations')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {integrations.map((integration) => (
                <li key={integration.name} className="flex items-center gap-2 text-sm">
                  {integration.configured ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="capitalize">{integration.name}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {integration.configured ? t('configured') : t('notConfigured')}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {can(user, 'settings') && audit.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border text-sm">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="text-muted-foreground">{entry.entityType}</span>
                    {entry.summary ? <span className="truncate">{entry.summary}</span> : null}
                    <span className="ms-auto text-xs text-muted-foreground">
                      {entry.actorName ?? entry.actorEmail} ·{' '}
                      {new Intl.DateTimeFormat(intlLocale(locale), {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
