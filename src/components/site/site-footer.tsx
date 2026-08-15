import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { pickI18n, type Locale } from '@/i18n/config'
import { formatAddress, identityOf } from '@/lib/settings/identity'
import { getNavigation, getSiteSettings } from '@/lib/settings/service'
import { isExternalHref } from '@/lib/utils'
import { NewsletterForm } from './newsletter-form'

const socialIcons = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
} as const

export async function SiteFooter({ locale }: { locale: Locale }) {
  const [settings, footerItems, legalItems, t] = await Promise.all([
    getSiteSettings(),
    getNavigation('footer'),
    getNavigation('legal'),
    getTranslations('footer'),
  ])

  const { social } = settings
  // One source for name, address and phone, shared with the structured data
  // and the receipts.
  const identity = identityOf(settings)
  const socialEntries = (Object.keys(socialIcons) as (keyof typeof socialIcons)[])
    .map((key) => ({ key, url: social[key] }))
    .filter((entry): entry is { key: keyof typeof socialIcons; url: string } => Boolean(entry.url))

  return (
    <footer className="mt-auto border-t border-border bg-surface text-surface-foreground">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4 lg:py-16">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-lg font-bold">{settings.siteName}</p>
          {pickI18n(settings.tagline, locale) ? (
            <p className="text-sm text-muted-foreground">{pickI18n(settings.tagline, locale)}</p>
          ) : null}

          {socialEntries.length > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              {socialEntries.map(({ key, url }) => {
                const Icon = socialIcons[key]
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={key}
                    className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors touch-target hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon className="size-4" aria-hidden />
                  </a>
                )
              })}
            </div>
          ) : null}
        </div>

        {footerItems.length > 0 ? (
          <nav aria-label={t('quickLinks')} className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t('quickLinks')}</p>
            <ul className="flex flex-col gap-2">
              {footerItems.map((item) => (
                <li key={item.id}>
                  {isExternalHref(item.href) ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {pickI18n(item.label, locale)}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {pickI18n(item.label, locale)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">{t('contactUs')}</p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {identity.email ? (
              <li>
                <a
                  href={`mailto:${identity.email}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  {identity.email}
                </a>
              </li>
            ) : null}
            {identity.phone ? (
              <li>
                <a
                  href={`tel:${identity.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {identity.phone}
                </a>
              </li>
            ) : null}
            {formatAddress(identity) ? (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {formatAddress(identity)}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        {settings.features.newsletter ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t('newsletterTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('newsletterText')}</p>
            <NewsletterForm locale={locale} />
          </div>
        ) : null}
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-3 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {identity.legalName ?? identity.name}.{' '}
            {t('rights')}
          </p>
          {legalItems.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-4">
              {legalItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="transition-colors hover:text-foreground">
                    {pickI18n(item.label, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
