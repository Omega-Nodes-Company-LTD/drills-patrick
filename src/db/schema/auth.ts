import { relations } from 'drizzle-orm'
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, localeEnum, timestamps } from './shared'

/**
 * Roles:
 * - `admin`   full access, including users, settings and integrations
 * - `editor`  content, media and projects
 * - `finance` donations, campaigns and reporting (read-only on content)
 */
export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'finance'])

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text().notNull().unique(),
    passwordHash: text().notNull(),
    name: text().notNull(),
    role: userRoleEnum().notNull().default('editor'),
    locale: localeEnum().notNull().default('en'),
    avatarUrl: text(),
    isActive: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('users_role_idx').on(table.role)],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('password_reset_tokens_user_idx').on(table.userId)],
)

/** Every admin mutation is recorded here. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    summary: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('audit_log_created_idx').on(table.createdAt),
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  auditEntries: many(auditLog),
  resetTokens: many(passwordResetTokens),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserRole = (typeof userRoleEnum.enumValues)[number]
