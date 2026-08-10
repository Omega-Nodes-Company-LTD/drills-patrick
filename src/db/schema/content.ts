import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { I18nTextValue } from '@/i18n/schema'
import type { Block } from '@/lib/blocks/schema'
import { users } from './auth'
import { teamMembers } from './crm'
import { media } from './media'
import { id, localeEnum, publishStatusEnum, timestamps } from './shared'

/**
 * Pages are block-composed. The block structure is shared across locales and
 * each textual leaf is an i18n object, so a layout is arranged once and only
 * the copy gets translated. Slug and SEO metadata stay per locale.
 */
export const pages = pgTable(
  'pages',
  {
    id: id(),
    /** Stable identifier used by code (`home`, `about`, ...). */
    key: text().notNull().unique(),
    status: publishStatusEnum().notNull().default('draft'),
    /** Pages flagged as system cannot be deleted from the admin. */
    isSystem: boolean().notNull().default(false),
    showInSitemap: boolean().notNull().default(true),
    blocks: jsonb().$type<Block[]>().notNull().default([]),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('pages_status_idx').on(table.status)],
)

export const pageTranslations = pgTable(
  'page_translations',
  {
    id: id(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    title: text().notNull().default(''),
    slug: text().notNull(),
    seoTitle: text(),
    seoDescription: text(),
    ...timestamps,
  },
  (table) => [
    unique('page_translations_page_locale_key').on(table.pageId, table.locale),
    unique('page_translations_locale_slug_key').on(table.locale, table.slug),
  ],
)

export const categories = pgTable('categories', {
  id: id(),
  color: text(),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
})

export const categoryTranslations = pgTable(
  'category_translations',
  {
    id: id(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
  },
  (table) => [
    unique('category_translations_category_locale_key').on(table.categoryId, table.locale),
    unique('category_translations_locale_slug_key').on(table.locale, table.slug),
  ],
)

export const tags = pgTable('tags', {
  id: id(),
  ...timestamps,
})

export const tagTranslations = pgTable(
  'tag_translations',
  {
    id: id(),
    tagId: uuid()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
  },
  (table) => [
    unique('tag_translations_tag_locale_key').on(table.tagId, table.locale),
    unique('tag_translations_locale_slug_key').on(table.locale, table.slug),
  ],
)

export const posts = pgTable(
  'posts',
  {
    id: id(),
    coverId: uuid().references(() => media.id, { onDelete: 'set null' }),
    categoryId: uuid().references(() => categories.id, { onDelete: 'set null' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /**
     * Public byline. A technical report is worth what its author's
     * qualifications are worth, and the admin account that saved it is not
     * necessarily the person who wrote it.
     */
    authorMemberId: uuid().references(() => teamMembers.id, { onDelete: 'set null' }),
    status: publishStatusEnum().notNull().default('draft'),
    isFeatured: boolean().notNull().default(false),
    readingMinutes: integer().notNull().default(3),
    viewCount: integer().notNull().default(0),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('posts_status_published_idx').on(table.status, table.publishedAt),
    index('posts_category_idx').on(table.categoryId),
    index('posts_author_member_idx').on(table.authorMemberId),
  ],
)

export const postTranslations = pgTable(
  'post_translations',
  {
    id: id(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    locale: localeEnum().notNull(),
    title: text().notNull().default(''),
    slug: text().notNull(),
    excerpt: text(),
    /** TipTap document — the editor's source of truth. */
    contentJson: jsonb().$type<Record<string, unknown>>(),
    /** Sanitised HTML rendered on the site and indexed for search. */
    contentHtml: text().notNull().default(''),
    seoTitle: text(),
    seoDescription: text(),
    ...timestamps,
  },
  (table) => [
    unique('post_translations_post_locale_key').on(table.postId, table.locale),
    unique('post_translations_locale_slug_key').on(table.locale, table.slug),
    index('post_translations_locale_idx').on(table.locale),
  ],
)

export const postTags = pgTable(
  'post_tags',
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: uuid()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.tagId] })],
)

export const pagesRelations = relations(pages, ({ many }) => ({
  translations: many(pageTranslations),
}))

export const pageTranslationsRelations = relations(pageTranslations, ({ one }) => ({
  page: one(pages, { fields: [pageTranslations.pageId], references: [pages.id] }),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  cover: one(media, { fields: [posts.coverId], references: [media.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  translations: many(postTranslations),
  postTags: many(postTags),
}))

export const postTranslationsRelations = relations(postTranslations, ({ one }) => ({
  post: one(posts, { fields: [postTranslations.postId], references: [posts.id] }),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  translations: many(categoryTranslations),
  posts: many(posts),
}))

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  translations: many(tagTranslations),
  postTags: many(postTags),
}))

export const tagTranslationsRelations = relations(tagTranslations, ({ one }) => ({
  tag: one(tags, { fields: [tagTranslations.tagId], references: [tags.id] }),
}))

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}))

export type PageRow = typeof pages.$inferSelect
export type PageTranslationRow = typeof pageTranslations.$inferSelect
export type PostRow = typeof posts.$inferSelect
export type PostTranslationRow = typeof postTranslations.$inferSelect
export type CategoryRow = typeof categories.$inferSelect
export type TagRow = typeof tags.$inferSelect

/** Re-exported for convenience where an i18n JSON column is used. */
export type ContentI18n = I18nTextValue
