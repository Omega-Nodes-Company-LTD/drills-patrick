'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { locales, type Locale } from '@/i18n/config'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import {
  collections,
  deleteCollectionRow,
  schemaFor,
  tablesFor,
  type CollectionKey,
} from '@/lib/admin/collections'
import { sanitizeHtml } from '@/lib/sanitize'
import type { ActionResult } from '@/lib/validation/public'

/**
 * One save/delete pair for FAQs, partners, team members and testimonials.
 * Shape and validation come from the field definitions in
 * `src/lib/admin/collections.ts`.
 */

const KEYS: CollectionKey[] = ['faq', 'partner', 'team', 'testimonial']

export async function saveCollectionItem(
  key: CollectionKey,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!KEYS.includes(key)) return { ok: false, error: 'invalid' }

  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = schemaFor(key).safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  const def = collections[key]
  const { base, translation, parent, fk } = tablesFor(key)
  const data = parsed.data

  // Empty strings from the form are stored as NULL rather than ''.
  const baseValues: Record<string, unknown> = { sortOrder: data.sortOrder }
  for (const field of def.fields.filter((entry) => !entry.translated)) {
    const value = (data.base as Record<string, unknown>)[field.name]
    baseValues[field.name] = value === '' ? null : value
  }

  let id = data.id

  if (id) {
    await db.update(base).set(baseValues).where(eq(base.id, id))
  } else {
    const [created] = await db
      .insert(base)
      .values(baseValues as never)
      .returning({ id: base.id })
    id = created!.id
  }

  await db.delete(translation).where(eq(parent, id))

  const translatedFields = def.fields.filter((field) => field.translated)

  for (const locale of locales) {
    const row: Record<string, unknown> = { [fk]: id, locale }
    let hasContent = false

    for (const field of translatedFields) {
      const values = (data.translations as Record<string, Partial<Record<Locale, string>>>)[
        field.name
      ]
      const raw = values?.[locale] ?? ''
      // Rich text is sanitised on the way in, like every other editor field.
      const value = field.type === 'richtext' ? sanitizeHtml(raw) : raw

      row[field.name] = value
      if (value.trim()) hasContent = true
    }

    if (hasContent) {
      await db.insert(translation).values(row as never)
    }
  }

  await recordAudit({
    actor: user,
    action: data.id ? `${key}.update` : `${key}.create`,
    entityType: key,
    entityId: id,
    summary: String((data.base as Record<string, unknown>)[def.labelField] ?? ''),
  })

  revalidatePath('/', 'layout')
  return { ok: true, data: { id } }
}

export async function deleteCollectionItem(
  key: CollectionKey,
  id: string,
): Promise<ActionResult> {
  if (!KEYS.includes(key)) return { ok: false, error: 'invalid' }

  const user = await requireApiUser('content')
  if (!user) return { ok: false, error: 'unauthorised' }

  await deleteCollectionRow(key, id)

  await recordAudit({ actor: user, action: `${key}.delete`, entityType: key, entityId: id })

  revalidatePath('/', 'layout')
  return { ok: true }
}
