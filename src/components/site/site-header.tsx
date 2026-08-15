import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { pickI18n, type Locale } from '@/i18n/config'
import { getMediaById } from '@/lib/media/service'
import { getNavigation, getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'
import { isExternalHref } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { LanguageSwitcher } from './language-switcher'
import { MobileNav } from './mobile-nav'

export async function SiteHeader({ locale }: { locale: Locale }) {
  const [settings, items, t] = await Promise.all([
    getSiteSettings(),
    getNavigation('header'),
    getTranslations('nav'),
  ])

  const logo = await getMediaById(settings.logoLightId)
  const logoSrc = mediaUrl(logo?.objectKey)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/*
        `min-w-0` on both the row and the brand link: the site name is
        `truncate`d, so its min-content width is the whole string, and a flex
        item defaults to `min-width: auto`. Without this an operator-chosen long
        name pushes the menu button off-screen and the page scrolls sideways.
      */}
      <div className="container-page flex h-16 min-w-0 items-center gap-3 md:h-18">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 font-heading text-lg font-bold"
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo size is set by the operator
            <img
              src={logoSrc}
              alt={settings.siteName}
              className="h-9 w-auto max-w-[45vw] shrink-0 object-contain sm:max-w-none"
            />
          ) : (
            <span className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
              {settings.siteName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate">{settings.siteName}</span>
        </Link>

        <nav className="ms-auto hidden items-center gap-1 lg:flex" aria-label={t('home')}>
          {items
            .filter((item) => !item.highlight)
            .map((item) => {
              const label = pickI18n(item.label, locale)
              return isExternalHref(item.href) ? (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {label}
                </Link>
              )
            })}
        </nav>

        {/* `shrink-0`: the brand name gives way, never the menu button. */}
        <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-2">
          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher locales={settings.enabledLocales} compact />
            <ThemeToggle />
          </div>

          {items
            .filter((item) => item.highlight)
            .slice(0, 1)
            .map((item) => (
              <Button key={item.id} asChild size="sm" className="hidden sm:inline-flex">
                <Link href={item.href}>{pickI18n(item.label, locale)}</Link>
              </Button>
            ))}

          <MobileNav items={items} locale={locale} locales={settings.enabledLocales} />
        </div>
      </div>
    </header>
  )
}
