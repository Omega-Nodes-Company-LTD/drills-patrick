import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { campaigns, donations } from './fundraising'
import { media } from './media'
import { projects } from './projects'
import { id, localeEnum, timestamps } from './shared'

/**
 * The ways money arrives beyond a single person pressing "donate".
 *
 * A supporter running a marathon, a company that wants an invoice, a donor
 * standing over a well for a year, an employer doubling what their staff give:
 * each has its own paperwork and its own promises, and none of them fit in the
 * donations table alone.
 *
 * Nothing here invents a policy. Invoice numbering, tax treatment, who matches
 * a gift and up to what ceiling are all set by the operator, because getting
 * them wrong is a legal problem rather than a cosmetic one.
 */

// ------------------------------------------------------- peer-to-peer pages

export const fundraiserStatusEnum = pgEnum('fundraiser_status', [
  'pending',
  'approved',
  'rejected',
  'closed',
])

/**
 * A page a supporter runs on the organisation's behalf.
 *
 * Held for approval by default: these pages carry the organisation's name and
 * are written by people it has no contract with, so one going live unread is a
 * reputational risk that costs nothing to avoid.
 *
 * `manageTokenHash` lets the owner come back and edit without an account —
 * asking a volunteer to register would lose most of them, and the token is
 * stored hashed so a database leak does not hand over the pages.
 */
export const fundraisers = pgTable(
  'fundraisers',
  {
    id: id(),
    slug: text().notNull().unique(),
    ownerName: text().notNull(),
    ownerEmail: text().notNull(),
    title: text().notNull(),
    story: text().notNull().default(''),
    coverId: uuid().references(() => media.id, { onDelete: 'set null' }),
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    goalAmountMinor: bigint({ mode: 'number' }).notNull().default(0),
    /** Kept in step with the donations that point here, so lists stay cheap. */
    raisedAmountMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull(),
    status: fundraiserStatusEnum().notNull().default('pending'),
    /** Why it was rejected, shown to the owner rather than kept private. */
    moderationNote: text(),
    manageTokenHash: text().notNull(),
    locale: localeEnum().notNull().default('en'),
    endsOn: date(),
    ...timestamps,
  },
  (table) => [
    index('fundraisers_status_idx').on(table.status, table.createdAt),
    index('fundraisers_email_idx').on(table.ownerEmail),
  ],
)

// ------------------------------------------------------------ adopt a well

/**
 * A donor who stands behind one water point for a period.
 *
 * The promise being made is not "your money went somewhere" but "this well is
 * yours to follow", so the row records what was promised — how often updates
 * go out — and when one was last actually sent. Without the second field the
 * promise is unenforceable and nobody notices it lapsing.
 */
export const wellAdoptions = pgTable(
  'well_adoptions',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    donationId: uuid().references(() => donations.id, { onDelete: 'set null' }),
    donorName: text().notNull(),
    donorEmail: text().notNull(),
    donorOrganisation: text(),
    startedOn: date().notNull(),
    endsOn: date(),
    amountMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull(),
    /** Months between updates. The operator sets it; nothing is assumed. */
    updateEveryMonths: integer().notNull().default(3),
    lastUpdateSentAt: timestamp({ withTimezone: true }),
    /** Shown next to the water point when the adopter agrees to be named. */
    isPublic: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    locale: localeEnum().notNull().default('en'),
    note: text(),
    ...timestamps,
  },
  (table) => [
    index('well_adoptions_project_idx').on(table.projectId),
    index('well_adoptions_active_idx').on(table.isActive, table.lastUpdateSentAt),
  ],
)

// -------------------------------------------------------- corporate giving

/**
 * A company shown on a project it paid for.
 *
 * Separate from the donation because the relationship outlives the payment:
 * the logo stays up for the agreed period, and a company may give more than
 * once against the same placement.
 */
export const corporateSponsors = pgTable(
  'corporate_sponsors',
  {
    id: id(),
    name: text().notNull(),
    logoId: uuid().references(() => media.id, { onDelete: 'set null' }),
    websiteUrl: text(),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'set null' }),
    donationId: uuid().references(() => donations.id, { onDelete: 'set null' }),
    /** Free-text tier label; the operator names their own levels. */
    tier: text(),
    contactName: text(),
    contactEmail: text(),
    /** Billing identity, which is often not the trading name. */
    legalName: text(),
    vatNumber: text(),
    addressLines: text().array().notNull().default([]),
    country: text(),
    isPublished: boolean().notNull().default(false),
    startsOn: date(),
    endsOn: date(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('corporate_sponsors_project_idx').on(table.projectId, table.sortOrder),
    index('corporate_sponsors_published_idx').on(table.isPublished),
  ],
)

/**
 * An invoice issued for a corporate gift.
 *
 * The number is assigned by the application and never reused, because a gap or
 * a duplicate in an invoice series is the kind of thing a tax inspection is
 * looking for. The series, the starting number and the tax treatment come from
 * the settings: they differ by country and by year, and guessing them here
 * would be inventing a fiscal policy.
 *
 * Amounts are stored as issued rather than recomputed on read, so a later
 * change to the tax rate cannot silently rewrite last year's paperwork.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    number: text().notNull().unique(),
    series: text().notNull(),
    sequence: integer().notNull(),
    year: integer().notNull(),
    donationId: uuid().references(() => donations.id, { onDelete: 'set null' }),
    sponsorId: uuid().references(() => corporateSponsors.id, { onDelete: 'set null' }),
    issuedOn: date().notNull(),
    /** Billing snapshot, frozen at issue. */
    billToName: text().notNull(),
    billToVat: text(),
    billToAddress: text().notNull().default(''),
    billToCountry: text(),
    description: text().notNull().default(''),
    netMinor: bigint({ mode: 'number' }).notNull(),
    /** Basis points, so 22% is 2200 and half-point rates still fit. */
    taxRateBp: integer().notNull().default(0),
    taxMinor: bigint({ mode: 'number' }).notNull().default(0),
    grossMinor: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull(),
    /** The wording that explains why tax was or was not charged. */
    taxNote: text(),
    voidedAt: timestamp({ withTimezone: true }),
    voidReason: text(),
    ...timestamps,
  },
  (table) => [
    unique('invoices_series_sequence_key').on(table.series, table.year, table.sequence),
    index('invoices_issued_idx').on(table.issuedOn),
  ],
)

// ------------------------------------------------------------- milestones

/**
 * A visible step on the way to a campaign's goal.
 *
 * "€12,000 to go" moves nobody. "€400 more and the pump gets a solar array"
 * is a decision someone can make today, which is the entire reason these
 * exist. Thresholds are amounts, not percentages, so the promise is concrete.
 */
export const campaignMilestones = pgTable(
  'campaign_milestones',
  {
    id: id(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    thresholdMinor: bigint({ mode: 'number' }).notNull(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [index('campaign_milestones_campaign_idx').on(table.campaignId, table.thresholdMinor)],
)

export const campaignMilestoneTranslations = pgTable(
  'campaign_milestone_translations',
  {
    id: id(),
    milestoneId: uuid()
      .notNull()
      .references(() => campaignMilestones.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    label: text().notNull().default(''),
    description: text().notNull().default(''),
  },
  (table) => [unique('campaign_milestone_translations_key').on(table.milestoneId, table.locale)],
)

// ----------------------------------------------------------- matching gift

/**
 * A pledge to multiply what other people give, within limits.
 *
 * Every field here is a term the matcher agreed to and the site is now
 * promising in public: the ratio, the ceiling, the window. None of it is
 * guessed. `matchedMinor` is what has actually been committed so far, so the
 * counter stops at the ceiling instead of promising money nobody pledged.
 */
export const matchingPledges = pgTable(
  'matching_pledges',
  {
    id: id(),
    /** Null means the pledge applies site-wide rather than to one campaign. */
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'cascade' }),
    matcherName: text().notNull(),
    matcherLogoId: uuid().references(() => media.id, { onDelete: 'set null' }),
    matcherUrl: text(),
    /** Basis points: 10000 doubles a gift, 5000 adds half. */
    ratioBp: integer().notNull().default(10_000),
    /** The most the matcher will give in total. */
    ceilingMinor: bigint({ mode: 'number' }).notNull(),
    /** The most any single gift can attract, when the matcher caps it. */
    perDonationCapMinor: bigint({ mode: 'number' }),
    matchedMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    isActive: boolean().notNull().default(true),
    note: text(),
    ...timestamps,
  },
  (table) => [index('matching_pledges_window_idx').on(table.isActive, table.startsAt, table.endsAt)],
)

// --------------------------------------------------------- solidarity gift

/**
 * A donation given in someone else's name, with a card for them.
 *
 * `deliverOn` exists because these are bought before the occasion and must not
 * arrive early; `viewTokenHash` because the card is a page the recipient opens
 * from an email, and an enumerable id would let anyone read strangers' notes.
 */
export const giftCards = pgTable(
  'gift_cards',
  {
    id: id(),
    donationId: uuid()
      .notNull()
      .references(() => donations.id, { onDelete: 'cascade' }),
    senderName: text().notNull(),
    senderEmail: text(),
    recipientName: text().notNull(),
    recipientEmail: text(),
    message: text().notNull().default(''),
    /** Which card design was chosen; the operator supplies the artwork. */
    designId: uuid().references(() => media.id, { onDelete: 'set null' }),
    occasion: text(),
    deliverOn: date(),
    sentAt: timestamp({ withTimezone: true }),
    viewTokenHash: text().notNull(),
    locale: localeEnum().notNull().default('en'),
    ...timestamps,
  },
  (table) => [
    index('gift_cards_delivery_idx').on(table.sentAt, table.deliverOn),
    index('gift_cards_donation_idx').on(table.donationId),
  ],
)

// ------------------------------------------------------ legacies and major

export const legacyEnquiryKindEnum = pgEnum('legacy_enquiry_kind', [
  'legacy',
  'major_gift',
  'foundation',
  'in_memory',
])

export const legacyEnquiryStatusEnum = pgEnum('legacy_enquiry_status', [
  'new',
  'in_conversation',
  'closed',
])

/**
 * A conversation about a gift too large or too personal for a payment form.
 *
 * Kept apart from ordinary contact messages on purpose: someone writing about
 * their will is owed a reply from a named person within days, and a row that
 * sits in the same list as a spelling correction will not get one.
 */
export const legacyEnquiries = pgTable(
  'legacy_enquiries',
  {
    id: id(),
    kind: legacyEnquiryKindEnum().notNull().default('legacy'),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    country: text(),
    organisation: text(),
    message: text().notNull().default(''),
    /** How they would rather be contacted, in their words. */
    preferredContact: text(),
    status: legacyEnquiryStatusEnum().notNull().default('new'),
    adminNote: text(),
    locale: localeEnum().notNull().default('en'),
    ...timestamps,
  },
  (table) => [index('legacy_enquiries_status_idx').on(table.status, table.createdAt)],
)

// ------------------------------------------------------------ recurring

export const recurringStatusEnum = pgEnum('recurring_status', [
  'active',
  'paused',
  'cancelled',
])

export const recurringIntervalEnum = pgEnum('recurring_interval', [
  'monthly',
  'quarterly',
  'yearly',
])

/**
 * A standing gift the donor can change without writing to anyone.
 *
 * The reason to build this rather than handle changes by email is retention:
 * a donor who cannot find the pause button cancels instead, and a cancelled
 * gift does not come back. `manageTokenHash` gives them a link that works from
 * their inbox without an account.
 */
export const recurringPlans = pgTable(
  'recurring_plans',
  {
    id: id(),
    reference: text().notNull().unique(),
    donorName: text(),
    donorEmail: text().notNull(),
    campaignId: uuid().references(() => campaigns.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    amountMinor: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull(),
    interval: recurringIntervalEnum().notNull().default('monthly'),
    status: recurringStatusEnum().notNull().default('active'),
    provider: text().notNull(),
    /** Subscription id at the provider, when it runs the schedule. */
    providerRef: text(),
    nextChargeOn: date(),
    pausedUntil: date(),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    manageTokenHash: text().notNull(),
    locale: localeEnum().notNull().default('en'),
    ...timestamps,
  },
  (table) => [
    index('recurring_plans_status_idx').on(table.status, table.nextChargeOn),
    index('recurring_plans_email_idx').on(table.donorEmail),
  ],
)

// ------------------------------------------------------------------- links

/**
 * Which page a gift came in through.
 *
 * A join row rather than a column on `donations`, because the donations table
 * is imported by everything and pointing it back at this file would make the
 * schema circular. The unique constraint keeps it a one-to-one in practice.
 */
export const fundraiserDonations = pgTable(
  'fundraiser_donations',
  {
    id: id(),
    fundraiserId: uuid()
      .notNull()
      .references(() => fundraisers.id, { onDelete: 'cascade' }),
    donationId: uuid()
      .notNull()
      .references(() => donations.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    unique('fundraiser_donations_donation_key').on(table.donationId),
    index('fundraiser_donations_fundraiser_idx').on(table.fundraiserId),
  ],
)

/**
 * What a single gift actually drew from a pledge.
 *
 * Recorded per donation rather than as a running total alone, so the counter
 * can be rebuilt from evidence and a donor can be told exactly what their gift
 * unlocked. A gift arriving after the ceiling is reached simply has no row.
 */
export const matchingAllocations = pgTable(
  'matching_allocations',
  {
    id: id(),
    pledgeId: uuid()
      .notNull()
      .references(() => matchingPledges.id, { onDelete: 'cascade' }),
    donationId: uuid()
      .notNull()
      .references(() => donations.id, { onDelete: 'cascade' }),
    matchedMinor: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    unique('matching_allocations_donation_key').on(table.donationId),
    index('matching_allocations_pledge_idx').on(table.pledgeId),
  ],
)

/** One payment taken against a standing gift. */
export const recurringCharges = pgTable(
  'recurring_charges',
  {
    id: id(),
    planId: uuid()
      .notNull()
      .references(() => recurringPlans.id, { onDelete: 'cascade' }),
    donationId: uuid()
      .notNull()
      .references(() => donations.id, { onDelete: 'cascade' }),
    chargedOn: date().notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    unique('recurring_charges_donation_key').on(table.donationId),
    index('recurring_charges_plan_idx').on(table.planId, table.chargedOn),
  ],
)

// --------------------------------------------------------------- relations

export const fundraisersRelations = relations(fundraisers, ({ one, many }) => ({
  cover: one(media, { fields: [fundraisers.coverId], references: [media.id] }),
  campaign: one(campaigns, { fields: [fundraisers.campaignId], references: [campaigns.id] }),
  project: one(projects, { fields: [fundraisers.projectId], references: [projects.id] }),
  donations: many(donations),
}))

export const wellAdoptionsRelations = relations(wellAdoptions, ({ one }) => ({
  project: one(projects, { fields: [wellAdoptions.projectId], references: [projects.id] }),
  donation: one(donations, { fields: [wellAdoptions.donationId], references: [donations.id] }),
}))

export const corporateSponsorsRelations = relations(corporateSponsors, ({ one, many }) => ({
  logo: one(media, { fields: [corporateSponsors.logoId], references: [media.id] }),
  project: one(projects, { fields: [corporateSponsors.projectId], references: [projects.id] }),
  invoices: many(invoices),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  donation: one(donations, { fields: [invoices.donationId], references: [donations.id] }),
  sponsor: one(corporateSponsors, {
    fields: [invoices.sponsorId],
    references: [corporateSponsors.id],
  }),
}))

export const campaignMilestonesRelations = relations(campaignMilestones, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [campaignMilestones.campaignId],
    references: [campaigns.id],
  }),
  translations: many(campaignMilestoneTranslations),
}))

export const campaignMilestoneTranslationsRelations = relations(
  campaignMilestoneTranslations,
  ({ one }) => ({
    milestone: one(campaignMilestones, {
      fields: [campaignMilestoneTranslations.milestoneId],
      references: [campaignMilestones.id],
    }),
  }),
)

export const matchingPledgesRelations = relations(matchingPledges, ({ one }) => ({
  campaign: one(campaigns, { fields: [matchingPledges.campaignId], references: [campaigns.id] }),
  logo: one(media, { fields: [matchingPledges.matcherLogoId], references: [media.id] }),
}))

export const giftCardsRelations = relations(giftCards, ({ one }) => ({
  donation: one(donations, { fields: [giftCards.donationId], references: [donations.id] }),
}))

export const recurringPlansRelations = relations(recurringPlans, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [recurringPlans.campaignId], references: [campaigns.id] }),
  project: one(projects, { fields: [recurringPlans.projectId], references: [projects.id] }),
  charges: many(recurringCharges),
}))

export const fundraiserDonationsRelations = relations(fundraiserDonations, ({ one }) => ({
  fundraiser: one(fundraisers, {
    fields: [fundraiserDonations.fundraiserId],
    references: [fundraisers.id],
  }),
  donation: one(donations, {
    fields: [fundraiserDonations.donationId],
    references: [donations.id],
  }),
}))

export const matchingAllocationsRelations = relations(matchingAllocations, ({ one }) => ({
  pledge: one(matchingPledges, {
    fields: [matchingAllocations.pledgeId],
    references: [matchingPledges.id],
  }),
  donation: one(donations, {
    fields: [matchingAllocations.donationId],
    references: [donations.id],
  }),
}))

export const recurringChargesRelations = relations(recurringCharges, ({ one }) => ({
  plan: one(recurringPlans, {
    fields: [recurringCharges.planId],
    references: [recurringPlans.id],
  }),
  donation: one(donations, {
    fields: [recurringCharges.donationId],
    references: [donations.id],
  }),
}))

export type Fundraiser = typeof fundraisers.$inferSelect
export type WellAdoption = typeof wellAdoptions.$inferSelect
export type CorporateSponsor = typeof corporateSponsors.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type CampaignMilestone = typeof campaignMilestones.$inferSelect
export type MatchingPledge = typeof matchingPledges.$inferSelect
export type GiftCard = typeof giftCards.$inferSelect
export type LegacyEnquiry = typeof legacyEnquiries.$inferSelect
export type RecurringPlan = typeof recurringPlans.$inferSelect
