import type { Metadata } from 'next'
import { staticAlternates } from '@/lib/seo'
import { absoluteUrl } from '@/lib/url'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { ThemeScript, ThemeStyle } from '@/components/theme/theme-style'
import { locales, pickI18n, type Locale } from '@/i18n/config'
import { routing } from '@/i18n/routing'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'
import { getMediaById } from '@/lib/media/service'


export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const settings = await getSiteSettings()
  const activeLocale = (hasLocale(routing.locales, locale) ? locale : routing.defaultLocale) as Locale

  const title = pickI18n(settings.seo.metaTitle, activeLocale) || settings.siteName
  const description =
    pickI18n(settings.seo.metaDescription, activeLocale) ||
    pickI18n(settings.description, activeLocale)

  // Wrapped so a missing database during a build never breaks metadata.
  const [ogImage, favicon] = await Promise.all([
    settings.ogImageId ? getMediaById(settings.ogImageId).catch(() => null) : null,
    settings.faviconId ? getMediaById(settings.faviconId).catch(() => null) : null,
  ])

  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: {
      default: title,
      template: `%s · ${settings.siteName}`,
    },
    description,
    keywords: settings.seo.keywords,
    // Only a fallback: pages inherit `alternates` when they do not set it, so
    // every route below builds its own canonical (see src/lib/seo.ts).
    alternates: staticAlternates(activeLocale, '/', settings.enabledLocales),
    openGraph: {
      type: 'website',
      siteName: settings.siteName,
      title,
      description,
      locale: activeLocale,
      images: ogImage ? [{ url: mediaUrl(ogImage.objectKey) }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      site: settings.seo.twitterHandle,
    },
    icons: favicon ? { icon: mediaUrl(favicon.objectKey) } : undefined,
    verification: settings.seo.googleSiteVerification
      ? { google: settings.seo.googleSiteVerification }
      : undefined,
    // A language the operator switched off stays reachable for existing links
    // but is withdrawn from the index rather than disappearing abruptly.
    robots: settings.enabledLocales.includes(activeLocale)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'common' })

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Server-rendered so the configured palette is applied on first paint. */}
        <ThemeStyle />
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
