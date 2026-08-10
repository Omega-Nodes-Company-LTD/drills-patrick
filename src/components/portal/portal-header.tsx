import { getTranslations } from 'next-intl/server'
import { partnerSignOut } from '@/app/actions/partner'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import type { PartnerSession } from '@/lib/auth/partner-session'
import { cn } from '@/lib/utils'

/** Portal chrome: who is signed in, where they are, and the way out. */
export async function PortalHeader({
  session,
  locale,
  active,
}: {
  session: PartnerSession
  locale: Locale
  active: 'projects' | 'documents' | 'contracts'
}) {
  const t = await getTranslations('portal')

  const tabs = [
    { key: 'projects' as const, href: '/portal', label: t('projects') },
    { key: 'documents' as const, href: '/portal/documents', label: t('documents') },
    { key: 'contracts' as const, href: '/portal/contracts', label: t('contracts') },
  ]

  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-title">{session.partnerName}</h1>
          <p className="text-small text-muted-foreground">
            {t('signedInAs', { name: session.name })}
          </p>
        </div>

        <form
          action={async () => {
            'use server'
            await partnerSignOut(locale)
          }}
        >
          <button
            type="submit"
            className="text-small text-muted-foreground underline hover:text-danger"
          >
            {t('signOut')}
          </button>
        </form>
      </div>

      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === active ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab.key === active
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/75 hover:bg-muted',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
