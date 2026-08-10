import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'
import { id, localeEnum, timestamps } from './shared'

/**
 * Vector index over public content.
 *
 * The dimension is fixed at the column level (1536, matching
 * `text-embedding-3-small`). Pointing `EMBEDDINGS_MODEL` at a model with a
 * different dimension requires a dedicated migration — see README.
 */
export const EMBEDDING_DIMENSIONS = 1536

export const embeddableEntityEnum = pgEnum('embeddable_entity', [
  'post',
  'project',
  'campaign',
  'page',
  'faq',
])

export const contentEmbeddings = pgTable(
  'content_embeddings',
  {
    id: id(),
    entityType: embeddableEntityEnum().notNull(),
    entityId: uuid().notNull(),
    locale: localeEnum().notNull(),
    chunkIndex: integer().notNull().default(0),
    /** Plain-text chunk, also used to build the RAG context. */
    content: text().notNull(),
    /** Title of the source document, kept for citation rendering. */
    title: text().notNull().default(''),
    url: text().notNull().default(''),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    /** Hash of the source text; unchanged chunks are not re-embedded. */
    contentHash: text().notNull(),
    tokenCount: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique('content_embeddings_chunk_key').on(
      table.entityType,
      table.entityId,
      table.locale,
      table.chunkIndex,
    ),
    index('content_embeddings_entity_idx').on(table.entityType, table.entityId),
    index('content_embeddings_locale_idx').on(table.locale),
    index('content_embeddings_vector_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
)

export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: id(),
    locale: localeEnum().notNull().default('en'),
    visitorId: text(),
    /** Set when a visitor leaves contact details from the chat. */
    contactEmail: text(),
    userAgent: text(),
    lastMessageAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('chat_conversations_created_idx').on(table.createdAt)],
)

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: text().notNull(),
    content: text().notNull(),
    citations: jsonb()
      .$type<{ title: string; url: string; entityType: string; entityId: string }[]>()
      .notNull()
      .default([]),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('chat_messages_conversation_idx').on(table.conversationId, table.createdAt)],
)

export const chatConversationsRelations = relations(chatConversations, ({ many }) => ({
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}))

export type ContentEmbeddingRow = typeof contentEmbeddings.$inferSelect
export type EmbeddableEntity = (typeof embeddableEntityEnum.enumValues)[number]
