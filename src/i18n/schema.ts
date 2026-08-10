import { z } from 'zod'

/**
 * Zod schema for translatable values stored in JSON columns.
 * Every locale is optional; rendering falls back through `pickI18n`.
 */
export const i18nTextSchema = z.object({
  en: z.string().optional(),
  fr: z.string().optional(),
  it: z.string().optional(),
  de: z.string().optional(),
  lg: z.string().optional(),
})

export type I18nTextValue = z.infer<typeof i18nTextSchema>

/** Same shape, but the values hold sanitised HTML produced by the editor. */
export const i18nRichTextSchema = i18nTextSchema

export const i18nTextRequired = i18nTextSchema.refine(
  (value) => Object.values(value).some((entry) => (entry ?? '').trim().length > 0),
  { message: 'Provide the text in at least one language' },
)
