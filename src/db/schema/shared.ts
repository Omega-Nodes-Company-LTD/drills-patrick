import { sql } from 'drizzle-orm'
import { pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Primary key shared by every table. */
export const id = () =>
  uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`)

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()

export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

export const localeEnum = pgEnum('locale', ['en', 'fr', 'it', 'de', 'lg'])

/** Publication state shared by every editorial entity. */
export const publishStatusEnum = pgEnum('publish_status', ['draft', 'published', 'archived'])

export const timestamps = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}
