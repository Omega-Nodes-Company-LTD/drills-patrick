import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SignInForm } from '@/components/admin/sign-in-form'
import type { Locale } from '@/i18n/config'
import { getCurrentUser } from '@/lib/auth/session'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  // Already signed in: go straight to the dashboard.
  if (await getCurrentUser()) redirect(`/${locale}/admin`)

  const [t, settings] = await Promise.all([getTranslations('admin.signIn'), getSiteSettings()])

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-heading text-xl font-bold">{settings.siteName}</p>
          <h1 className="mt-4 text-heading">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <SignInForm locale={locale} />
      </div>
    </div>
  )
}
