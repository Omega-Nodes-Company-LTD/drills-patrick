import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { media } from './media'
import { projects } from './projects'
import { id, localeEnum, timestamps } from './shared'

/** NGOs, institutions and companies the company works with. */
export const partners = pgTable('partners', {
  id: id(),
  name: text().notNull(),
  logoId: uuid().references(() => media.id, { onDelete: 'set null' }),
  websiteUrl: text(),
  tier: text().notNull().default('partner'),
  isPublished: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
})

export const partnerTranslations = pgTable(
  'partner_translations',
  {
    id: id(),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    description: text(),
  },
  (table) => [unique('partner_translations_partner_locale_key').on(table.partnerId, table.locale)],
)

export const teamMembers = pgTable('team_members', {
  id: id(),
  name: text().notNull(),
  photoId: uuid().references(() => media.id, { onDelete: 'set null' }),
  email: text(),
  linkedinUrl: text(),
  isPublished: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
})

export const teamMemberTranslations = pgTable(
  'team_member_translations',
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => teamMembers.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    role: text().notNull().default(''),
    bio: text(),
  },
  (table) => [unique('team_member_translations_member_locale_key').on(table.memberId, table.locale)],
)

export const testimonials = pgTable('testimonials', {
  id: id(),
  authorName: text().notNull(),
  organisation: text(),
  photoId: uuid().references(() => media.id, { onDelete: 'set null' }),
  projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
  isPublished: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
})

export const testimonialTranslations = pgTable(
  'testimonial_translations',
  {
    id: id(),
    testimonialId: uuid()
      .notNull()
      .references(() => testimonials.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    role: text(),
    quote: text().notNull().default(''),
  },
  (table) => [
    unique('testimonial_translations_testimonial_locale_key').on(
      table.testimonialId,
      table.locale,
    ),
  ],
)

export const faqs = pgTable('faqs', {
  id: id(),
  category: text().notNull().default('general'),
  isPublished: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
})

export const faqTranslations = pgTable(
  'faq_translations',
  {
    id: id(),
    faqId: uuid()
      .notNull()
      .references(() => faqs.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    question: text().notNull().default(''),
    answerHtml: text().notNull().default(''),
  },
  (table) => [unique('faq_translations_faq_locale_key').on(table.faqId, table.locale)],
)

export const inquiryStatusEnum = pgEnum('inquiry_status', [
  'new',
  'in_review',
  'quoted',
  'won',
  'lost',
  'archived',
])

/** Lead form used by NGOs asking for a quote or a feasibility study. */
export const ngoInquiries = pgTable(
  'ngo_inquiries',
  {
    id: id(),
    organisationName: text().notNull(),
    contactName: text().notNull(),
    email: text().notNull(),
    phone: text(),
    country: text(),
    region: text(),
    /** Requested intervention, matching `waterPointTypeEnum` values. */
    interventionType: text(),
    wellsRequested: integer(),
    beneficiariesEstimate: integer(),
    budgetMinor: bigint({ mode: 'number' }),
    currency: text(),
    timeframe: text(),
    message: text().notNull().default(''),
    status: inquiryStatusEnum().notNull().default('new'),
    assignedToId: uuid().references(() => users.id, { onDelete: 'set null' }),
    adminNote: text(),
    locale: localeEnum().notNull().default('en'),
    source: text(),
    ...timestamps,
  },
  (table) => [index('ngo_inquiries_status_idx').on(table.status, table.createdAt)],
)

export const contactSubmissions = pgTable(
  'contact_submissions',
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    subject: text(),
    message: text().notNull(),
    locale: localeEnum().notNull().default('en'),
    isHandled: boolean().notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('contact_submissions_created_idx').on(table.createdAt)],
)

export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: id(),
    email: text().notNull().unique(),
    name: text(),
    locale: localeEnum().notNull().default('en'),
    isConfirmed: boolean().notNull().default(false),
    confirmToken: text(),
    unsubscribedAt: timestamp({ withTimezone: true }),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('newsletter_subscribers_confirmed_idx').on(table.isConfirmed)],
)

export const partnersRelations = relations(partners, ({ one, many }) => ({
  logo: one(media, { fields: [partners.logoId], references: [media.id] }),
  translations: many(partnerTranslations),
}))

export const partnerTranslationsRelations = relations(partnerTranslations, ({ one }) => ({
  partner: one(partners, { fields: [partnerTranslations.partnerId], references: [partners.id] }),
}))

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  photo: one(media, { fields: [teamMembers.photoId], references: [media.id] }),
  translations: many(teamMemberTranslations),
}))

export const teamMemberTranslationsRelations = relations(teamMemberTranslations, ({ one }) => ({
  member: one(teamMembers, {
    fields: [teamMemberTranslations.memberId],
    references: [teamMembers.id],
  }),
}))

export const testimonialsRelations = relations(testimonials, ({ one, many }) => ({
  photo: one(media, { fields: [testimonials.photoId], references: [media.id] }),
  project: one(projects, { fields: [testimonials.projectId], references: [projects.id] }),
  translations: many(testimonialTranslations),
}))

export const testimonialTranslationsRelations = relations(testimonialTranslations, ({ one }) => ({
  testimonial: one(testimonials, {
    fields: [testimonialTranslations.testimonialId],
    references: [testimonials.id],
  }),
}))

export const faqsRelations = relations(faqs, ({ many }) => ({
  translations: many(faqTranslations),
}))

export const faqTranslationsRelations = relations(faqTranslations, ({ one }) => ({
  faq: one(faqs, { fields: [faqTranslations.faqId], references: [faqs.id] }),
}))

export type PartnerRow = typeof partners.$inferSelect
export type TeamMemberRow = typeof teamMembers.$inferSelect
export type TestimonialRow = typeof testimonials.$inferSelect
export type FaqRow = typeof faqs.$inferSelect
export type NgoInquiryRow = typeof ngoInquiries.$inferSelect
