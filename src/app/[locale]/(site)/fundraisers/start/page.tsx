import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { FundraiserStartForm } from '@/components/site/fundraiser-start-form'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { listCampaigns, listProjects } from '@/lib/content/queries'
import { staticAlternates } from '@/lib/seo'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'fundraisers' }),
    getSiteSettings(),
  ])

  return {
    title: t('startTitle'),
    description: t('startSubtitle'),
    alternates: staticAlternates(locale, '/fundraisers/start', settings.enabledLocales),
  }
}

export default async function StartFundraiserPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, settings, campaigns, projects] = await Promise.all([
    getTranslations('fundraisers'),
    getSiteSettings(),
    listCampaigns({ locale, limit: 50 }),
    listProjects({ locale, limit: 50 }),
  ])

  return (
    <>
      <PageHeader title={t('startTitle')} subtitle={t('startSubtitle')} />
      <div className="container-page max-w-2xl py-10 md:py-14">
        <FundraiserStartForm
          locale={locale}
          currencies={settings.donations.currencies}
          defaultCurrency={settings.donations.defaultCurrency}
          campaigns={campaigns.items.map((item) => ({ id: item.id, title: item.title }))}
          projects={projects.items.map((item) => ({ id: item.id, title: item.title }))}
        />
      </div>
    </>
  )
}
