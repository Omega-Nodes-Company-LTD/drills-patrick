import { getTranslations } from 'next-intl/server'
import { MediaImage } from '@/components/ui/media-image'
import type { MediaRow } from '@/db/schema'
import type { Locale } from '@/i18n/config'

/**
 * Who paid for this water point, and who is following it.
 *
 * Companies get their logo because that is what was agreed in exchange for
 * funding it, and it is a fact about the borehole rather than an
 * advertisement. Individual adopters are named only where they said yes, and
 * never with an amount — a page that ranks people by what they gave is a
 * different and worse page.
 */
export async function ProjectBackers({
  sponsors,
  adopters,
  locale,
}: {
  sponsors: { id: string; name: string; websiteUrl: string | null; tier: string | null; logo?: MediaRow | null }[]
  adopters: { id: string; donorName: string; donorOrganisation: string | null; startedOn: string }[]
  locale: Locale
}) {
  if (sponsors.length === 0 && adopters.length === 0) return null

  const [tCorporate, tAdoption] = await Promise.all([
    getTranslations('corporate'),
    getTranslations('adoption'),
  ])

  return (
    <div className="flex flex-col gap-8">
      {sponsors.length > 0 ? (
        <section>
          <h2 className="mb-4 text-heading">{tCorporate('sponsors')}</h2>
          <ul className="flex flex-wrap items-center gap-6">
            {sponsors.map((sponsor) => {
              const label = sponsor.tier ? `${sponsor.name} · ${sponsor.tier}` : sponsor.name

              const body = sponsor.logo ? (
                <span className="relative block h-12 w-32">
                  <MediaImage
                    media={sponsor.logo}
                    locale={locale}
                    sizes="128px"
                    alt={sponsor.name}
                    className="object-contain"
                  />
                </span>
              ) : (
                <span className="text-sm font-medium">{label}</span>
              )

              return (
                <li key={sponsor.id} title={label}>
                  {sponsor.websiteUrl ? (
                    <a
                      href={sponsor.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block transition-opacity hover:opacity-80"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {adopters.length > 0 ? (
        <section>
          <h2 className="mb-4 text-heading">{tAdoption('adopters')}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {adopters.map((adopter) => (
              <li key={adopter.id} className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">
                  {adopter.donorOrganisation || adopter.donorName}
                </span>
                <span className="text-muted-foreground">
                  {tAdoption('since', { date: adopter.startedOn })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
