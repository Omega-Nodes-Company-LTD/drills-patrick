import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  faqTranslations,
  faqs,
  partnerTranslations,
  partners,
  teamMemberTranslations,
  teamMembers,
  testimonialTranslations,
  testimonials,
} from '@/db/schema'
import { locales, type Locale } from '@/i18n/config'
import { groupByParent } from '@/lib/content/translations'
import {
  collections,
  type CollectionItem,
  type CollectionKey,
} from './collection-fields'

export * from './collection-fields'

/**
 * Small editorial collections — FAQs, partners, team members, testimonials.
 *
 * They all have the same shape: a base row plus one translation row per
 * language, no slug and no publication workflow beyond a visibility switch.
 * Describing them once keeps four near-identical CRUD screens from existing.
 */

/** Drizzle handles for each collection, kept out of the client bundle. */
const tables = {
  faq: { base: faqs, translation: faqTranslations, parent: faqTranslations.faqId, fk: 'faqId' },
  partner: {
    base: partners,
    translation: partnerTranslations,
    parent: partnerTranslations.partnerId,
    fk: 'partnerId',
  },
  team: {
    base: teamMembers,
    translation: teamMemberTranslations,
    parent: teamMemberTranslations.memberId,
    fk: 'memberId',
  },
  testimonial: {
    base: testimonials,
    translation: testimonialTranslations,
    parent: testimonialTranslations.testimonialId,
    fk: 'testimonialId',
  },
} as const

export function tablesFor(key: CollectionKey) {
  return tables[key]
}

export async function listCollection(key: CollectionKey): Promise<CollectionItem[]> {
  const { base, translation, parent, fk } = tables[key]
  const def = collections[key]

  const rows = await db.select().from(base).orderBy(asc(base.sortOrder))
  if (rows.length === 0) return []

  const translated = await db
    .select()
    .from(translation)
    .where(
      inArray(
        parent,
        rows.map((row) => row.id),
      ),
    )

  const byParent = groupByParent(translated as (Record<string, unknown> & { locale: string })[], fk)
  const translatedFields = def.fields.filter((field) => field.translated).map((field) => field.name)

  return rows.map((row) => {
    const translations: CollectionItem['translations'] = {}

    for (const field of translatedFields) {
      translations[field] = {}
      for (const entry of byParent.get(row.id) ?? []) {
        const value = (entry as Record<string, unknown>)[field]
        if (typeof value === 'string') {
          translations[field]![(entry as { locale: string }).locale as Locale] = value
        }
      }
    }

    return {
      id: row.id,
      sortOrder: (row as { sortOrder: number }).sortOrder,
      base: row as Record<string, unknown>,
      translations,
    }
  })
}

/** Validation is generated from the field definitions, so the two cannot drift. */
export function schemaFor(key: CollectionKey) {
  const def = collections[key]
  const base: Record<string, z.ZodTypeAny> = {}
  const translated: Record<string, z.ZodTypeAny> = {}

  for (const field of def.fields) {
    const target = field.translated ? translated : base

    switch (field.type) {
      case 'switch':
        target[field.name] = z.boolean().default(true)
        break
      case 'image':
        // The form sends '' for "no image" — both for a new row and for an
        // existing one whose column is null. That is absence, not a malformed
        // id, and it is already what the writer below assumes when it maps ''
        // to NULL. Without this the only way to save a member, partner or
        // testimonial was to give it a picture first.
        target[field.name] = z.preprocess(
          (value) => (value === '' ? null : value),
          z.string().uuid().nullish(),
        )
        break
      case 'richtext':
        target[field.name] = z.string().max(200_000).optional()
        break
      case 'textarea':
        target[field.name] = z.string().trim().max(4000).optional()
        break
      default:
        target[field.name] = field.required
          ? z.string().trim().min(1).max(300)
          : z.string().trim().max(300).optional()
    }
  }

  const localeRecord = (inner: z.ZodTypeAny) =>
    z.object(Object.fromEntries(locales.map((locale) => [locale, inner.optional()])))

  return z.object({
    id: z.string().uuid().optional(),
    sortOrder: z.coerce.number().int().default(0),
    base: z.object(base),
    translations: z.object(
      Object.fromEntries(
        Object.entries(translated).map(([name, inner]) => [name, localeRecord(inner)]),
      ),
    ),
  })
}

export async function deleteCollectionRow(key: CollectionKey, id: string): Promise<void> {
  const { base } = tables[key]
  await db.delete(base).where(eq(base.id, id))
}
