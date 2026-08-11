import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
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
import type { I18nTextValue } from '@/i18n/schema'
import { users } from './auth'
import { media } from './media'
import { projects } from './projects'
import { id, localeEnum, publishStatusEnum, timestamps } from './shared'

export const paymentProviderEnum = pgEnum('payment_provider', [
  'stripe',
  'paypal',
  'pesapal',
  'mtn',
  'airtel',
  'bank',
  'manual',
])

export const donationStatusEnum = pgEnum('donation_status', [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
])

export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    coverId: uuid().references(() => media.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    status: publishStatusEnum().notNull().default('draft'),
    isFeatured: boolean().notNull().default(false),

    /** Amounts in minor units of `currency`. */
    goalAmount: bigint({ mode: 'number' }).notNull().default(0),
    /** Cached sum of succeeded donations, refreshed on every state change. */
    raisedAmount: bigint({ mode: 'number' }).notNull().default(0),
    /** Money collected outside the platform (grants, offline pledges). */
    offlineAmount: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull().default('EUR'),

    startsOn: date(),
    endsOn: date(),

    suggestedAmounts: jsonb().$type<number[]>().notNull().default([]),
    /** "€50 gives a family clean water for a year" — shown next to amounts. */
    impactTiers: jsonb()
      .$type<{ amount: number; label: I18nTextValue }[]>()
      .notNull()
      .default([]),
    allowCustomAmount: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('campaigns_status_idx').on(table.status)],
)

export const campaignTranslations = pgTable(
  'campaign_translations',
  {
    id: id(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    title: text().notNull().default(''),
    slug: text().notNull(),
    summary: text(),
    contentJson: jsonb().$type<Record<string, unknown>>(),
    contentHtml: text().notNull().default(''),
    seoTitle: text(),
    seoDescription: text(),
    ...timestamps,
  },
  (table) => [
    unique('campaign_translations_campaign_locale_key').on(table.campaignId, table.locale),
    unique('campaign_translations_locale_slug_key').on(table.locale, table.slug),
  ],
)

export const donations = pgTable(
  'donations',
  {
    id: id(),
    reference: text().notNull().unique(),
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),

    provider: paymentProviderEnum().notNull(),
    /** Identifier returned by the provider (session id, order id, ...). */
    providerRef: text(),
    status: donationStatusEnum().notNull().default('pending'),

    amountMinor: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull(),
    /** Provider fee, when reported. */
    feeMinor: bigint({ mode: 'number' }),

    donorName: text(),
    donorEmail: text(),
    donorPhone: text(),
    donorOrganisation: text(),
    donorCountry: text(),
    isAnonymous: boolean().notNull().default(false),
    message: text(),
    locale: localeEnum().notNull().default('en'),

    isRecurring: boolean().notNull().default(false),
    receiptNumber: text(),
    receiptSentAt: timestamp({ withTimezone: true }),

    /**
     * Named on the public supporter wall. Opt-in, and separate from
     * `isAnonymous`: choosing not to be listed on a wall is a different
     * decision from wanting the gift itself kept private, and defaulting
     * either one to "yes" publishes a name nobody agreed to publish.
     */
    showOnWall: boolean().notNull().default(false),
    /** What to call them on the wall, when it is not their legal name. */
    wallDisplayName: text(),

    /** Set when an admin confirms an offline payment. */
    confirmedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp({ withTimezone: true }),
    adminNote: text(),

    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index('donations_status_idx').on(table.status, table.createdAt),
    index('donations_campaign_idx').on(table.campaignId),
    index('donations_provider_ref_idx').on(table.provider, table.providerRef),
    index('donations_email_idx').on(table.donorEmail),
  ],
)

/**
 * Raw provider callbacks. `eventKey` is unique so a webhook replay can never
 * credit a campaign twice.
 */
export const donationEvents = pgTable(
  'donation_events',
  {
    id: id(),
    donationId: uuid().references(() => donations.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum().notNull(),
    eventKey: text().notNull().unique(),
    eventType: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('donation_events_donation_idx').on(table.donationId)],
)

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  cover: one(media, { fields: [campaigns.coverId], references: [media.id] }),
  project: one(projects, { fields: [campaigns.projectId], references: [projects.id] }),
  translations: many(campaignTranslations),
  donations: many(donations),
}))

export const campaignTranslationsRelations = relations(campaignTranslations, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignTranslations.campaignId],
    references: [campaigns.id],
  }),
}))

export const donationsRelations = relations(donations, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [donations.campaignId], references: [campaigns.id] }),
  project: one(projects, { fields: [donations.projectId], references: [projects.id] }),
  confirmedBy: one(users, { fields: [donations.confirmedById], references: [users.id] }),
  events: many(donationEvents),
}))

export const donationEventsRelations = relations(donationEvents, ({ one }) => ({
  donation: one(donations, { fields: [donationEvents.donationId], references: [donations.id] }),
}))

export type CampaignRow = typeof campaigns.$inferSelect
export type CampaignTranslationRow = typeof campaignTranslations.$inferSelect
export type DonationRow = typeof donations.$inferSelect
export type NewDonation = typeof donations.$inferInsert
export type DonationStatus = (typeof donationStatusEnum.enumValues)[number]
export type PaymentProviderId = (typeof paymentProviderEnum.enumValues)[number]
