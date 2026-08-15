import type { Metadata, Viewport } from 'next'
import { localeUrl, staticAlternates } from '@/lib/seo'
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

/**
 * `width=device-width, initial-scale=1` is Next's default and is kept. What is
 * added here is `viewportFit`, without which `env(safe-area-inset-*)` — used by
 * the chat launcher and the admin action bar — always resolves to zero, and a
 * `themeColor` so the mobile address bar follows the active theme.
 *
 * `maximumScale` is deliberately left alone: capping it would stop users
 * pinch-zooming, which is a WCAG failure.
 */
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1c26' },
  ],
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
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getSiteSettings(),
  ])
  const feedTitle = settings.siteName

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Server-rendered so the configured palette is applied on first paint. */}
        <ThemeStyle />
        <ThemeScript />
        {/*
          In <head> rather than in `alternates`: a route that sets its own
          canonical replaces the parent's alternates wholesale, so a feed
          advertised there would reach the home page only.
        */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={feedTitle}
          href={localeUrl(locale, '/feed.xml')}
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        {/*
          Top-right would sit on top of the sticky header and the hamburger on
          a phone, where sonner renders toasts full-width; the mobile offset
          drops them clear of both the site header (4rem) and the admin one
          (3.5rem).
        */}
        <Toaster
          position="top-right"
          mobileOffset={{ top: '4.75rem', left: '0.75rem', right: '0.75rem' }}
          richColors
          closeButton
        />
      </body>
    </html>
  )
}
