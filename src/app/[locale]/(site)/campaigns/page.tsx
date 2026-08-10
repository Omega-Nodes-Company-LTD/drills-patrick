import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/settings/service'
import { staticAlternates } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CampaignCard } from '@/components/site/cards'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { listCampaigns } from '@/lib/content/queries'

// Rendered per request: the content lives in the database, so the Docker
// build never needs a database connection.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const t = await getTranslations({ locale, namespace: 'campaigns' })
  const settings = await getSiteSettings()

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/campaigns', settings.enabledLocales),
  }
}

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const t = await getTranslations('campaigns')
  const { items } = await listCampaigns({ locale, limit: 24 })

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="container-page py-10 md:py-14">
        {items.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {items.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
