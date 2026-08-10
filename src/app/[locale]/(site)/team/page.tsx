import { Linkedin, Mail } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { EmptyState, PageHeader } from '@/components/site/page-header'
import { MediaImage } from '@/components/ui/media-image'
import type { Locale } from '@/i18n/config'
import { listTeamMembers } from '@/lib/content/queries'
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
    getTranslations({ locale, namespace: 'team' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/team', settings.enabledLocales),
  }
}

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tCommon, members] = await Promise.all([
    getTranslations('team'),
    getTranslations('common'),
    listTeamMembers(locale),
  ])

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container-page py-12">
        {members.length === 0 ? (
          <EmptyState message={tCommon('noResults')} />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground"
              >
                <div className="relative aspect-4/3">
                  <MediaImage
                    media={member.photo}
                    locale={locale}
                    alt={member.name}
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="text-heading">{member.name}</h2>
                  {member.role ? <p className="text-small text-primary">{member.role}</p> : null}
                  {member.bio ? (
                    <p className="text-small text-muted-foreground">{member.bio}</p>
                  ) : null}

                  {member.email || member.linkedinUrl ? (
                    <div className="mt-auto flex items-center gap-3 pt-3">
                      {member.email ? (
                        <a
                          href={`mailto:${member.email}`}
                          className="text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`${member.name} — email`}
                        >
                          <Mail className="size-5" aria-hidden />
                        </a>
                      ) : null}
                      {member.linkedinUrl ? (
                        <a
                          href={member.linkedinUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`${member.name} — LinkedIn`}
                        >
                          <Linkedin className="size-5" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
