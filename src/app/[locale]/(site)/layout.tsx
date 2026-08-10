import { setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ChatWidget } from '@/components/chat/chat-widget'
import { JsonLd } from '@/components/seo/json-ld'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { organisationNode } from '@/lib/seo/nodes'
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
      {/*
        Site-wide identity, identical on every page and therefore emitted once
        here. Page-level graphs point at these nodes by `@id`; consumers merge
        every JSON-LD block on a page into one dataset, so the references
        resolve.
      */}
      <JsonLd nodes={[organisationNode(settings, locale)]} />
      <SiteHeader locale={locale} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} />
      {showChat ? <ChatWidget locale={locale} /> : null}
    </div>
  )
}
