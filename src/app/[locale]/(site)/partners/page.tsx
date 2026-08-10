import { ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { listPartnersWithDescription } from '@/lib/content/queries'
import { staticAlternates } from '@/lib/seo'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'partners' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/partners', settings.enabledLocales),
  }
}

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tCommon, partners] = await Promise.all([
    getTranslations('partners'),
    getTranslations('common'),
    listPartnersWithDescription(locale),
  ])

  // Grouped by the tier the editor typed, in the order the list already has.
  const tiers = new Map<string, typeof partners>()
  for (const partner of partners) {
    const key = partner.tier?.trim() || ''
    const group = tiers.get(key)
    if (group) group.push(partner)
    else tiers.set(key, [partner])
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page flex flex-col gap-12 py-12">
        {partners.length === 0 ? (
          <EmptyState message={tCommon('noResults')} />
        ) : (
          [...tiers.entries()].map(([tier, group]) => (
            <section key={tier || 'all'} className="flex flex-col gap-6">
              {tier ? <h2 className="text-heading capitalize">{tier}</h2> : null}

              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((partner) => {
                  const logo = mediaUrl(partner.logo?.objectKey)

                  return (
                    <li
                      key={partner.id}
                      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-surface-foreground"
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logos vary in size and are not optimised
                        <img
                          src={logo}
                          alt={partner.name}
                          className="h-12 w-auto self-start object-contain"
                          loading="lazy"
                        />
                      ) : null}

                      <h3 className="font-heading text-lg font-semibold">{partner.name}</h3>

                      {partner.description ? (
                        <p className="text-small text-muted-foreground">{partner.description}</p>
                      ) : null}

                      {partner.websiteUrl ? (
                        <a
                          href={partner.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-auto inline-flex items-center gap-1.5 text-small font-medium text-primary hover:underline"
                        >
                          {tCommon('learnMore')}
                          <ExternalLink className="size-4" aria-hidden />
                        </a>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  )
}
