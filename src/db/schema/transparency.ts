import { relations } from 'drizzle-orm'
import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { id, localeEnum, timestamps } from './shared'

/**
 * The numbers the site asks to be believed on.
 *
 * An NGO deciding whether to fund a borehole, and a donor deciding whether to
 * give again, are both asking the same question: is this true. Everything here
 * exists to answer it with a figure that has a date, a source and a stated
 * method behind it, rather than a claim in a paragraph.
 */

/**
 * Readings taken at a water point over time.
 *
 * Yield on the day of drilling is a sales figure; yield three dry seasons
 * later is evidence. A borehole that dropped from 3000 to 400 l/h is the most
 * important thing anyone can know about it, and it is invisible unless the
 * measurements are kept as a series rather than overwritten on the project.
 */
export const waterPointReadings = pgTable(
  'water_point_readings',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    measuredOn: date().notNull(),
    /** Litres per hour at the time of measurement. */
    yieldLitersPerHour: integer(),
    /** Rest water level below ground, in metres. */
    staticLevelM: integer(),
    /** Free text: turbidity, taste, anything the technician noted. */
    note: text(),
    measuredBy: text(),
    ...timestamps,
  },
  (table) => [index('water_point_readings_project_idx').on(table.projectId, table.measuredOn)],
)

/**
 * A published impact figure, with how it was arrived at.
 *
 * "12,000 people served" means nothing without knowing who counted and how.
 * The methodology field is required reading, not a footnote: an indicator
 * without one is a claim, and the public page renders it as such.
 */
export const impactIndicators = pgTable(
  'impact_indicators',
  {
    id: id(),
    /** Stable key so a figure can be referenced from a page block. */
    key: text().notNull().unique(),
    value: text().notNull(),
    unit: text(),
    /** How the number was produced. Shown, not hidden behind a tooltip. */
    methodology: text().notNull().default(''),
    source: text(),
    /** When the figure was last checked. An old one says so. */
    verifiedOn: date(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [index('impact_indicators_order_idx').on(table.sortOrder)],
)

export const impactIndicatorTranslations = pgTable(
  'impact_indicator_translations',
  {
    id: id(),
    indicatorId: uuid()
      .notNull()
      .references(() => impactIndicators.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    label: text().notNull().default(''),
    methodology: text(),
  },
  (table) => [unique('impact_indicator_translations_key').on(table.indicatorId, table.locale)],
)

/**
 * Where the money went, by category and year.
 *
 * "How we spend it" is the page a first-time donor looks for and rarely
 * finds. Kept as rows the finance role edits rather than derived from
 * donations, because overheads, grants and in-kind contributions never appear
 * in a payment ledger and a page that ignores them is not honest.
 */
export const spendingEntries = pgTable(
  'spending_entries',
  {
    id: id(),
    year: integer().notNull(),
    category: text().notNull(),
    amountMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull().default('EUR'),
    note: text(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [index('spending_entries_year_idx').on(table.year, table.sortOrder)],
)

export const spendingEntryTranslations = pgTable(
  'spending_entry_translations',
  {
    id: id(),
    entryId: uuid()
      .notNull()
      .references(() => spendingEntries.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    label: text().notNull().default(''),
  },
  (table) => [unique('spending_entry_translations_key').on(table.entryId, table.locale)],
)

export const waterPointReadingsRelations = relations(waterPointReadings, ({ one }) => ({
  project: one(projects, { fields: [waterPointReadings.projectId], references: [projects.id] }),
}))

export const impactIndicatorsRelations = relations(impactIndicators, ({ many }) => ({
  translations: many(impactIndicatorTranslations),
}))

export const spendingEntriesRelations = relations(spendingEntries, ({ many }) => ({
  translations: many(spendingEntryTranslations),
}))

export type WaterPointReadingRow = typeof waterPointReadings.$inferSelect
export type ImpactIndicatorRow = typeof impactIndicators.$inferSelect
export type SpendingEntryRow = typeof spendingEntries.$inferSelect
