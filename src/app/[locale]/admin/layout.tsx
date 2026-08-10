import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import type { Locale } from '@/i18n/config'

/**
 * Bare wrapper for everything under `/admin`. The authenticated chrome lives in
 * the `(dashboard)` group so the login page can render without it.
 */
export default async function AdminRootLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return <div className="min-h-dvh bg-background">{children}</div>
}
