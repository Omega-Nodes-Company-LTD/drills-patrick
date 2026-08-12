import { Linkedin, Mail } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { pickI18n, type Locale } from '@/i18n/config'
import type {
  CampaignsBlock,
  ContactBlock,
  DonateBlock,
  FaqBlock,
  MapBlock,
  PartnersBlock,
  PostsBlock,
  ProjectsBlock,
  TeamBlock,
  TestimonialsBlock,
} from '@/lib/blocks/schema'
import {
  listCampaigns,
  listFaqs,
  listPartners,
  listPosts,
  listProjectMarkers,
  listProjects,
  listTeamMembers,
  listTestimonials,
} from '@/lib/content/queries'
import { initialsOf } from '@/lib/content/initials'
import { getSiteSettings } from '@/lib/settings/service'
import { mediaUrl } from '@/lib/storage/urls'
import { sanitizeHtml } from '@/lib/sanitize'
import { CampaignCard, MoreLink, PostCard, ProjectCard } from '@/components/site/cards'
import { ContactForm } from '@/components/site/contact-form'
import { NgoInquiryForm } from '@/components/site/ngo-inquiry-form'
import { ProjectsMap } from '@/components/site/projects-map'
import { FaqAccordion } from '@/components/site/faq-accordion'
import { DonationForm } from '@/components/donate/donation-form'
import { listAvailableProviders } from '@/lib/payments/registry'
import { MediaImage } from '@/components/ui/media-image'
import { Section, SectionHeading } from './section'

export async function ProjectsBlockView({
  block,
  locale,
}: {
  block: ProjectsBlock
  locale: Locale
}) {
  const { items } = await listProjects({
    locale,
    status: block.status === 'all' ? undefined : block.status,
    featuredOnly: block.featuredOnly,
    limit: block.limit,
  })

  if (items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          title={pickI18n(block.title, locale)}
          subtitle={pickI18n(block.subtitle, locale)}
        />
        {block.cta ? (
          <MoreLink href={block.cta.href} label={pickI18n(block.cta.label, locale)} />
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project) => (
          <ProjectCard key={project.id} project={project} locale={locale} />
        ))}
      </div>
    </Section>
  )
}

export async function PostsBlockView({ block, locale }: { block: PostsBlock; locale: Locale }) {
  const { items } = await listPosts({
    locale,
    limit: block.limit,
    categoryId: block.categoryId ?? undefined,
  })

  if (items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          title={pickI18n(block.title, locale)}
          subtitle={pickI18n(block.subtitle, locale)}
        />
        {block.cta ? (
          <MoreLink href={block.cta.href} label={pickI18n(block.cta.label, locale)} />
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((post) => (
          <PostCard key={post.id} post={post} locale={locale} />
        ))}
      </div>
    </Section>
  )
}

export async function CampaignsBlockView({
  block,
  locale,
}: {
  block: CampaignsBlock
  locale: Locale
}) {
  const { items } = await listCampaigns({
    locale,
    limit: block.limit,
    activeOnly: block.activeOnly,
  })

  if (items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        className="mb-8"
      />
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} locale={locale} />
        ))}
      </div>
    </Section>
  )
}

export async function PartnersBlockView({
  block,
  locale,
}: {
  block: PartnersBlock
  locale: Locale
}) {
  const partners = await listPartners(block.partnerIds.length > 0 ? block.partnerIds : undefined)
  if (partners.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        align="center"
        className="mb-8"
      />
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {partners.map((partner) => {
          const logo = mediaUrl(partner.logo?.objectKey)
          const content = logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos vary in size and are not optimised
            <img
              src={logo}
              alt={partner.name}
              className="h-10 w-auto opacity-70 transition-opacity hover:opacity-100 md:h-12"
              loading="lazy"
            />
          ) : (
            <span className="text-sm font-medium opacity-70 transition-opacity hover:opacity-100">
              {partner.name}
            </span>
          )

          return (
            <li key={partner.id}>
              {partner.websiteUrl ? (
                <a href={partner.websiteUrl} target="_blank" rel="noreferrer noopener">
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

export async function TestimonialsBlockView({
  block,
  locale,
}: {
  block: TestimonialsBlock
  locale: Locale
}) {
  const items = await listTestimonials(
    locale,
    block.testimonialIds.length > 0 ? block.testimonialIds : undefined,
  )
  if (items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading title={pickI18n(block.title, locale)} className="mb-8" />
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <figure
            key={item.id}
            className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-surface-foreground"
          >
            <blockquote className="text-base leading-relaxed">“{item.quote}”</blockquote>
            <figcaption className="mt-auto text-small">
              <span className="font-semibold">{item.authorName}</span>
              {item.role || item.organisation ? (
                <span className="block text-muted-foreground">
                  {[item.role, item.organisation].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}

const TEAM_COLUMNS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export async function TeamBlockView({ block, locale }: { block: TeamBlock; locale: Locale }) {
  const members = await listTeamMembers(
    locale,
    block.memberIds.length > 0 ? block.memberIds : undefined,
  )
  if (members.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        className="mb-8"
      />
      <ul className={`grid gap-6 ${TEAM_COLUMNS[block.columns] ?? TEAM_COLUMNS[3]}`}>
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground"
          >
            <div className="relative aspect-4/3">
              {member.photo ? (
                <MediaImage
                  media={member.photo}
                  locale={locale}
                  alt={member.name}
                  sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                />
              ) : (
                // No photograph yet. A neutral monogram reads as deliberate,
                // where a broken frame reads as a site nobody maintains.
                <div
                  className="flex size-full items-center justify-center bg-muted"
                  aria-hidden
                >
                  <span className="text-heading font-semibold text-muted-foreground">
                    {initialsOf(member.name)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-5">
              <h3 className="text-heading">{member.name}</h3>
              {member.role ? <p className="text-small text-primary">{member.role}</p> : null}
              {block.showCredentials && member.credentials ? (
                <p className="text-small text-muted-foreground">{member.credentials}</p>
              ) : null}
              {block.showBio && member.bio ? (
                <p className="text-small text-muted-foreground">{member.bio}</p>
              ) : null}

              {block.showContact && (member.email || member.linkedinUrl) ? (
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
    </Section>
  )
}

export async function FaqBlockView({ block, locale }: { block: FaqBlock; locale: Locale }) {
  const items = await listFaqs(locale, block.faqIds.length > 0 ? block.faqIds : undefined)
  if (items.length === 0) return null

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        className="mb-8"
      />
      <FaqAccordion
        items={items.map((item) => ({
          id: item.id,
          question: item.question,
          answerHtml: sanitizeHtml(item.answerHtml),
        }))}
      />
    </Section>
  )
}

export async function MapBlockView({ block, locale }: { block: MapBlock; locale: Locale }) {
  const markers = await listProjectMarkers(locale)
  const filtered = markers.filter((marker) => block.statuses.includes(marker.status))
  if (filtered.length === 0) return null

  const t = await getTranslations('projects')

  return (
    <Section layout={block.layout}>
      <SectionHeading
        title={pickI18n(block.title, locale)}
        subtitle={pickI18n(block.subtitle, locale)}
        className="mb-6"
      />
      <ProjectsMap
        center={block.center}
        zoom={block.zoom}
        markers={filtered.map((marker) => ({
          id: marker.id,
          slug: marker.slug,
          title: marker.title,
          status: marker.status,
          statusLabel: t(`status.${marker.status}`),
          lat: marker.latitude!,
          lng: marker.longitude!,
          district: marker.district,
        }))}
      />
    </Section>
  )
}

export async function ContactBlockView({
  block,
  locale,
}: {
  block: ContactBlock
  locale: Locale
}) {
  const settings = await getSiteSettings()
  const t = await getTranslations('contact')
  const { contact } = settings

  return (
    <Section layout={block.layout}>
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <SectionHeading
            title={pickI18n(block.title, locale)}
            subtitle={pickI18n(block.subtitle, locale)}
          />
          {block.variant === 'ngo' ? (
            <NgoInquiryForm
              locale={locale}
              currencies={settings.donations.currencies}
              defaultCurrency={settings.donations.defaultCurrency}
            />
          ) : (
            <ContactForm locale={locale} />
          )}
        </div>

        {block.showDetails ? (
          <aside className="flex h-fit flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-surface-foreground">
            <h3 className="text-subheading font-semibold">{t('details')}</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {contact.email ? (
                <li>
                  <a className="text-primary hover:underline" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.phone ? (
                <li>
                  <a
                    className="text-primary hover:underline"
                    href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                  >
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.addressLines.length > 0 || contact.city ? (
                <li className="text-muted-foreground">
                  {[...contact.addressLines, contact.city, contact.country]
                    .filter(Boolean)
                    .join(', ')}
                </li>
              ) : null}
            </ul>
            {pickI18n(contact.openingHours, locale) ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t('openingHours')}: </span>
                {pickI18n(contact.openingHours, locale)}
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </Section>
  )
}

export async function DonateBlockView({ block, locale }: { block: DonateBlock; locale: Locale }) {
  const [settings, providers] = await Promise.all([getSiteSettings(), listAvailableProviders()])

  const campaign = block.campaignId
    ? (await listCampaigns({ locale, limit: 50 })).items.find(
        (item) => item.id === block.campaignId,
      )
    : undefined

  const currency = block.currency ?? campaign?.currency ?? settings.donations.defaultCurrency

  return (
    <Section layout={block.layout}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <SectionHeading
          title={pickI18n(block.title, locale)}
          subtitle={pickI18n(block.subtitle, locale)}
          align="center"
        />
        <DonationForm
          locale={locale}
          providers={providers}
          currencies={settings.donations.currencies}
          defaultCurrency={currency}
          suggestedAmounts={
            block.suggestedAmounts.length > 0
              ? block.suggestedAmounts
              : (campaign?.suggestedAmounts ?? settings.donations.suggestedAmounts[currency] ?? [])
          }
          minAmounts={settings.donations.minAmount}
          campaignId={campaign?.id ?? null}
          campaignTitle={campaign?.title ?? null}
        />
      </div>
    </Section>
  )
}
