import { relations } from 'drizzle-orm'
import { index, integer, jsonb, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import type { I18nTextValue } from '@/i18n/schema'
import { users } from './auth'
import { id, timestamps } from './shared'

export const mediaKindEnum = pgEnum('media_kind', ['image', 'document', 'video', 'other'])

/**
 * Every uploaded asset. `objectKey` already contains `S3_PREFIX`, so the shared
 * Hetzner bucket can host several sites side by side.
 * `variants` maps a width to the object key of the resized derivative.
 */
export const media = pgTable(
  'media',
  {
    id: id(),
    objectKey: text().notNull().unique(),
    bucket: text().notNull(),
    kind: mediaKindEnum().notNull().default('image'),
    mimeType: text().notNull(),
    originalName: text().notNull(),
    sizeBytes: integer().notNull().default(0),
    width: integer(),
    height: integer(),
    /** Tiny base64 preview used as a blur placeholder. */
    placeholder: text(),
    variants: jsonb().$type<Record<string, string>>().notNull().default({}),
    alt: jsonb().$type<I18nTextValue>().notNull().default({}),
    caption: jsonb().$type<I18nTextValue>().notNull().default({}),
    credit: text(),
    folder: text().notNull().default('general'),
    uploadedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('media_folder_idx').on(table.folder),
    index('media_created_idx').on(table.createdAt),
    index('media_kind_idx').on(table.kind),
  ],
)

export const mediaRelations = relations(media, ({ one }) => ({
  uploadedBy: one(users, { fields: [media.uploadedById], references: [users.id] }),
}))

export type MediaRow = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert
