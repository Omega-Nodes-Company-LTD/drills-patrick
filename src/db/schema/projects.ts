import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  doublePrecision,
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
import { media } from './media'
import { id, localeEnum, publishStatusEnum, timestamps } from './shared'

/** Lifecycle of a water point, from planned to completed. */
export const projectStatusEnum = pgEnum('project_status', ['planned', 'in_progress', 'completed'])

export const waterPointTypeEnum = pgEnum('water_point_type', [
  'borehole',
  'shallow_well',
  'spring_protection',
  'rainwater_harvesting',
  'solar_pump',
  'rehabilitation',
  'piped_scheme',
])

export const projects = pgTable(
  'projects',
  {
    id: id(),
    coverId: uuid().references(() => media.id, { onDelete: 'set null' }),
    status: projectStatusEnum().notNull().default('planned'),
    publishStatus: publishStatusEnum().notNull().default('draft'),
    isFeatured: boolean().notNull().default(false),
    waterPointType: waterPointTypeEnum().notNull().default('borehole'),

    // Location
    country: text().notNull().default('Uganda'),
    region: text(),
    district: text(),
    village: text(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),

    // Technical figures shown to NGOs
    wellsCount: integer().notNull().default(1),
    depthMeters: integer(),
    yieldLitersPerHour: integer(),
    waterQualityNote: text(),

    // Impact
    beneficiaries: integer().notNull().default(0),
    households: integer(),
    schoolsServed: integer(),
    healthFacilitiesServed: integer(),

    // Schedule
    startDate: date(),
    completionDate: date(),
    plannedCompletionDate: date(),

    // Budget, in minor currency units
    budgetAmount: bigint({ mode: 'number' }),
    fundedAmount: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull().default('EUR'),

    galleryIds: jsonb().$type<string[]>().notNull().default([]),
    partnerIds: jsonb().$type<string[]>().notNull().default([]),
    sortOrder: integer().notNull().default(0),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('projects_status_idx').on(table.status, table.publishStatus),
    index('projects_location_idx').on(table.country, table.district),
    index('projects_featured_idx').on(table.isFeatured),
  ],
)

export const projectTranslations = pgTable(
  'project_translations',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
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
    unique('project_translations_project_locale_key').on(table.projectId, table.locale),
    unique('project_translations_locale_slug_key').on(table.locale, table.slug),
  ],
)

/** Timeline entries: drilling started, casing installed, handover, ... */
export const projectUpdates = pgTable(
  'project_updates',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    mediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    happenedOn: date().notNull(),
    sortOrder: integer().notNull().default(0),
    isPublished: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index('project_updates_project_idx').on(table.projectId, table.happenedOn)],
)

export const projectUpdateTranslations = pgTable(
  'project_update_translations',
  {
    id: id(),
    updateId: uuid()
      .notNull()
      .references(() => projectUpdates.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    title: text().notNull().default(''),
    body: text().notNull().default(''),
  },
  (table) => [unique('project_update_translations_update_locale_key').on(table.updateId, table.locale)],
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  cover: one(media, { fields: [projects.coverId], references: [media.id] }),
  translations: many(projectTranslations),
  updates: many(projectUpdates),
}))

export const projectTranslationsRelations = relations(projectTranslations, ({ one }) => ({
  project: one(projects, { fields: [projectTranslations.projectId], references: [projects.id] }),
}))

export const projectUpdatesRelations = relations(projectUpdates, ({ one, many }) => ({
  project: one(projects, { fields: [projectUpdates.projectId], references: [projects.id] }),
  media: one(media, { fields: [projectUpdates.mediaId], references: [media.id] }),
  translations: many(projectUpdateTranslations),
}))

export const projectUpdateTranslationsRelations = relations(
  projectUpdateTranslations,
  ({ one }) => ({
    update: one(projectUpdates, {
      fields: [projectUpdateTranslations.updateId],
      references: [projectUpdates.id],
    }),
  }),
)

export type ProjectRow = typeof projects.$inferSelect
export type ProjectTranslationRow = typeof projectTranslations.$inferSelect
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number]
export type WaterPointType = (typeof waterPointTypeEnum.enumValues)[number]
