import { count, eq, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { JsonLd } from '@/components/seo/json-ld'
import { PageHeader } from '@/components/site/page-header'
import { db } from '@/db'
import { projects, teamMemberTranslations, teamMembers } from '@/db/schema'
import { pickI18n, type Locale } from '@/i18n/config'
import { pickTranslation } from '@/lib/content/translations'
import { formatNumber } from '@/lib/money'
import { localeUrl, staticAlternates } from '@/lib/seo'
import { sectionBreadcrumb, webPageNode } from '@/lib/seo/nodes'
import { identityOf, formatAddress } from '@/lib/settings/identity'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

/**
 * Capability statement, generated from the delivery record.
 *
 * An NGO shortlisting drillers asks for one of these and normally receives a
 * PDF written by hand, whose numbers were true on the day someone typed them.
 * This one is computed from the projects actually delivered, so it cannot
 * drift, and it prints — a browser's own print-to-PDF beats a generated file
 * nobody can correct.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale }
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'capabilities' }),
    getSiteSettings(),
  ])

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: staticAlternates(locale, '/capabilities', settings.enabledLocales),
  }
}

export default async function CapabilitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [t, tNav, settings, totals, districts, byType, team, teamTranslations] = await Promise.all([
    getTranslations('capabilities'),
    getTranslations('nav'),
    getSiteSettings(),
    db
      .select({
        projects: count(),
        wells: sql<number>`coalesce(sum(${projects.wellsCount}), 0)::int`,
        beneficiaries: sql<number>`coalesce(sum(${projects.beneficiaries}), 0)::int`,
        maxDepth: sql<number>`coalesce(max(${projects.depthMeters}), 0)::int`,
        avgDepth: sql<number>`coalesce(round(avg(${projects.depthMeters})), 0)::int`,
      })
      .from(projects)
      .where(eq(projects.publishStatus, 'published')),
    db
      .selectDistinct({ district: projects.district })
      .from(projects)
      .where(eq(projects.publishStatus, 'published'))
      .orderBy(projects.district),
    db
      .select({ type: projects.waterPointType, total: count() })
      .from(projects)
      .where(eq(projects.publishStatus, 'published'))
      .groupBy(projects.waterPointType),
    db.select().from(teamMembers).where(eq(teamMembers.isPublished, true)).orderBy(teamMembers.sortOrder),
    db.select().from(teamMemberTranslations),
  ])

  const tProjects = await getTranslations('projects')
  const identity = identityOf(settings)
  const figures = totals[0]
  const url = localeUrl(locale, '/capabilities')

  const qualified = team.filter((member) => member.credentials?.trim())

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

      <div className="container-page flex flex-col gap-10 py-12 print:py-4">
        <section>
          <h2 className="mb-4 text-heading">{t('organisation')}</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [t('legalName'), identity.legalName ?? identity.name],
              [t('registration'), identity.registrationNumber],
              [t('based'), formatAddress(identity)],
              [t('contact'), identity.email],
              [t('phone'), identity.phone],
              [
                t('founded'),
                settings.organisation.foundedYear ? String(settings.organisation.foundedYear) : null,
              ],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-small text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{String(value)}</dd>
                </div>
              ))}
          </dl>
        </section>

        <section>
          <h2 className="mb-4 text-heading">{t('delivered')}</h2>
          {/* A real table, so the figures can be copied into a tender form. */}
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
            <table className="w-full text-sm">
              <tbody>
                {[
                  [t('projectsDelivered'), formatNumber(figures?.projects ?? 0, locale)],
                  [t('waterPoints'), formatNumber(figures?.wells ?? 0, locale)],
                  [t('peopleServed'), formatNumber(figures?.beneficiaries ?? 0, locale)],
                  [
                    t('districts'),
                    formatNumber(districts.filter((row) => row.district).length, locale),
                  ],
                  [t('averageDepth'), `${figures?.avgDepth ?? 0} m`],
                  [t('deepest'), `${figures?.maxDepth ?? 0} m`],
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 text-start font-medium">
                      {label}
                    </th>
                    <td className="px-4 py-3 text-end tabular-nums">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {byType.length > 0 ? (
          <section>
            <h2 className="mb-4 text-heading">{t('interventionTypes')}</h2>
            <ul className="flex flex-wrap gap-2">
              {byType.map((row) => (
                <li
                  key={row.type}
                  className="rounded-full border border-border px-4 py-1.5 text-sm"
                >
                  {tProjects(`type.${row.type}`)} · {row.total}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {qualified.length > 0 ? (
          <section>
            <h2 className="mb-4 text-heading">{t('teamQualifications')}</h2>
            <ul className="flex flex-col gap-3">
              {qualified.map((member) => {
                const translation = pickTranslation(
                  teamTranslations.filter((row) => row.memberId === member.id),
                  locale,
                )

                return (
                  <li key={member.id} className="border-b border-border pb-3 last:border-0">
                    <p className="font-medium">{member.name}</p>
                    <p className="text-small text-muted-foreground">
                      {[translation?.role, member.credentials].filter(Boolean).join(' — ')}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <p className="text-small text-muted-foreground">
          {t('generated', { date: new Date().toISOString().slice(0, 10) })}
          {settings.description ? ` · ${pickI18n(settings.description, locale)}` : ''}
        </p>
      </div>
    </>
  )
}
