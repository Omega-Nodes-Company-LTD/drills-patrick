import type { Locale } from '@/i18n/config'

/**
 * Field definitions for the small editorial collections.
 *
 * Kept free of any database import so the admin client components can read the
 * same descriptions the server validates against.
 */

export type FieldType = 'text' | 'textarea' | 'richtext' | 'url' | 'email' | 'image' | 'switch'

export type FieldDef = {
  name: string
  type: FieldType
  label: string
  /** Stored on the translation row, one value per language. */
  translated?: boolean
  required?: boolean
  hint?: string
}

export type CollectionKey = 'faq' | 'partner' | 'team' | 'testimonial'

export type CollectionDef = {
  key: CollectionKey
  /** Translation key under `admin.collections` for the screen title. */
  titleKey: string
  /** Base column used as the row label in the list. */
  labelField: string
  fields: FieldDef[]
}

export const collections: Record<CollectionKey, CollectionDef> = {
  faq: {
    key: 'faq',
    titleKey: 'faqs',
    labelField: 'question',
    fields: [
      { name: 'question', type: 'text', label: 'Question', translated: true, required: true },
      { name: 'answerHtml', type: 'richtext', label: 'Answer', translated: true },
      { name: 'category', type: 'text', label: 'Category', hint: 'costs, timelines, …' },
      { name: 'isPublished', type: 'switch', label: 'Published' },
    ],
  },
  partner: {
    key: 'partner',
    titleKey: 'partners',
    labelField: 'name',
    fields: [
      { name: 'name', type: 'text', label: 'Name', required: true },
      { name: 'logoId', type: 'image', label: 'Logo' },
      { name: 'websiteUrl', type: 'url', label: 'Website' },
      { name: 'tier', type: 'text', label: 'Tier', hint: 'ngo, foundation, institution' },
      { name: 'description', type: 'textarea', label: 'Description', translated: true },
      { name: 'isPublished', type: 'switch', label: 'Published' },
    ],
  },
  team: {
    key: 'team',
    titleKey: 'team',
    labelField: 'name',
    fields: [
      { name: 'name', type: 'text', label: 'Name', required: true },
      { name: 'photoId', type: 'image', label: 'Photo' },
      { name: 'role', type: 'text', label: 'Role', translated: true },
      { name: 'bio', type: 'textarea', label: 'Biography', translated: true },
      { name: 'email', type: 'email', label: 'Email' },
      { name: 'linkedinUrl', type: 'url', label: 'LinkedIn' },
      { name: 'isPublished', type: 'switch', label: 'Published' },
    ],
  },
  testimonial: {
    key: 'testimonial',
    titleKey: 'testimonials',
    labelField: 'authorName',
    fields: [
      { name: 'authorName', type: 'text', label: 'Author', required: true },
      { name: 'organisation', type: 'text', label: 'Organisation' },
      { name: 'photoId', type: 'image', label: 'Photo' },
      { name: 'role', type: 'text', label: 'Role', translated: true },
      { name: 'quote', type: 'textarea', label: 'Quote', translated: true, required: true },
      { name: 'isPublished', type: 'switch', label: 'Published' },
    ],
  },
}

export type CollectionItem = {
  id: string
  sortOrder: number
  /** Base columns. */
  base: Record<string, unknown>
  /** Translated columns, keyed by field then language. */
  translations: Record<string, Partial<Record<Locale, string>>>
}
