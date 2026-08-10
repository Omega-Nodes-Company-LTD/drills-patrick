import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ChatWidget } from '@/components/chat/chat-widget'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { getSiteSettings } from '@/lib/settings/service'

export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  const showChat = features.ragChat && settings.features.chatAssistant

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} />
      {showChat ? <ChatWidget locale={locale} /> : null}
    </div>
  )
}
