import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { LegacyForm } from '@/components/site/legacy-form'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { formatAddress, identityOf } from '@/lib/settings/identity'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'legacy' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/legacy', settings.enabledLocales),
  }
}

export default async function LegacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tNav, settings] = await Promise.all([
    getTranslations('legacy'),
    getTranslations('nav'),
    getSiteSettings(),
  ])

  const url = localeUrl(locale, '/legacy')
  const identity = identityOf(settings)
  const address = formatAddress(identity)

  return (
    <>
      <JsonLd
        nodes={[
          webPageNode({ locale, url, name: t('title'), description: t('subtitle') }),
          sectionBreadcrumb({
            locale,
            homeName: tNav('home'),
            pageName: t('title'),
            pageUrl: url,
          }),
        ]}
      />

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_18rem]">
        <div className="max-w-2xl">
          <LegacyForm locale={locale} />
        </div>

        {/*
          A solicitor drafting a will needs the exact legal name, the
          registration number and the registered address, in one place they can
          copy. Every one of these comes from the settings, so what a lawyer
          copies is what the organisation actually registered as.
        */}
        <aside className="h-fit rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-sm">
          <h2 className="mb-3 text-subheading font-semibold">
            {identity.legalName ?? identity.name}
          </h2>
          <dl className="flex flex-col gap-2">
            {identity.registrationNumber ? (
              <div>
                <dt className="text-muted-foreground">Registration</dt>
                <dd className="font-medium">{identity.registrationNumber}</dd>
              </div>
            ) : null}
            {address ? (
              <div>
                <dt className="text-muted-foreground">Registered address</dt>
                <dd className="font-medium">{address}</dd>
              </div>
            ) : null}
            {identity.email ? (
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium break-all">{identity.email}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </>
  )
}
