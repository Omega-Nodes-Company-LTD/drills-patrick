import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { PartnerSignInForm } from '@/components/portal/sign-in-form'
import type { Locale } from '@/i18n/config'
import { getPartnerSession } from '@/lib/auth/partner-session'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const t = await getTranslations({ locale, namespace: 'portal' })

  // The portal is for named partners; there is nothing here to index.
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  if (await getPartnerSession()) redirect({ href: '/portal', locale })

  const t = await getTranslations('portal')

  return (
    <div className="container-narrow py-16">
      <div className="mx-auto max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-8 text-surface-foreground">
        <h1 className="text-title">{t('title')}</h1>
        <p className="mb-6 mt-2 text-small text-muted-foreground">{t('loginIntro')}</p>
        <PartnerSignInForm />
      </div>
    </div>
  )
}
