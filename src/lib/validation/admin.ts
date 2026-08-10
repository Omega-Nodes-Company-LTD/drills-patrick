import { z } from 'zod'
import { locales } from '@/i18n/config'
import { blocksSchema } from '@/lib/blocks/schema'
import { parseAmount } from '@/lib/money'

/** Payloads accepted by the admin save actions. */

const translationBase = {
  title: z.string().trim().max(240).default(''),
  slug: z.string().trim().max(120).default(''),
  seoTitle: z.string().trim().max(240).optional(),
  seoDescription: z.string().trim().max(400).optional(),
}

export const postTranslationSchema = z.object({
  ...translationBase,
  excerpt: z.string().trim().max(600).optional(),
  contentHtml: z.string().max(400_000).default(''),
})

export const projectTranslationSchema = z.object({
  ...translationBase,
  summary: z.string().trim().max(600).optional(),
  contentHtml: z.string().max(400_000).default(''),
})

export const campaignTranslationSchema = projectTranslationSchema

export const pageTranslationSchema = z.object({ ...translationBase })

const translationsRecord = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    en: schema.optional(),
    fr: schema.optional(),
    it: schema.optional(),
    de: schema.optional(),
    lg: schema.optional(),
  })

export const publishStatus = z.enum(['draft', 'published', 'archived'])

export const postInputSchema = z.object({
  id: z.string().uuid().optional(),
  coverId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  status: publishStatus.default('draft'),
  isFeatured: z.boolean().default(false),
  tagIds: z.array(z.string().uuid()).default([]),
  translations: translationsRecord(postTranslationSchema),
})

export const projectInputSchema = z.object({
  id: z.string().uuid().optional(),
  coverId: z.string().uuid().nullish(),
  status: z.enum(['planned', 'in_progress', 'completed']).default('planned'),
  publishStatus: publishStatus.default('draft'),
  isFeatured: z.boolean().default(false),
  waterPointType: z
    .enum([
      'borehole',
      'shallow_well',
      'spring_protection',
      'rainwater_harvesting',
      'solar_pump',
      'rehabilitation',
      'piped_scheme',
    ])
    .default('borehole'),
  country: z.string().trim().max(80).default('Uganda'),
  region: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  village: z.string().trim().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  wellsCount: z.coerce.number().int().min(0).max(10_000).default(1),
  depthMeters: z.coerce.number().int().min(0).max(5000).nullish(),
  yieldLitersPerHour: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  waterQualityNote: z.string().trim().max(300).optional(),
  beneficiaries: z.coerce.number().int().min(0).max(10_000_000).default(0),
  households: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  schoolsServed: z.coerce.number().int().min(0).max(10_000).nullish(),
  healthFacilitiesServed: z.coerce.number().int().min(0).max(10_000).nullish(),
  startDate: z.string().trim().max(10).nullish(),
  completionDate: z.string().trim().max(10).nullish(),
  plannedCompletionDate: z.string().trim().max(10).nullish(),
  budgetAmount: z.coerce.number().min(0).nullish(),
  fundedAmount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().length(3).default('EUR'),
  galleryIds: z.array(z.string().uuid()).default([]),
  sortOrder: z.coerce.number().int().default(0),
  translations: translationsRecord(projectTranslationSchema),
})

export const campaignInputSchema = z.object({
  id: z.string().uuid().optional(),
  coverId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
  status: publishStatus.default('draft'),
  isFeatured: z.boolean().default(false),
  goalAmount: z.coerce.number().min(0).default(0),
  offlineAmount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().length(3).default('EUR'),
  startsOn: z.string().trim().max(10).nullish(),
  endsOn: z.string().trim().max(10).nullish(),
  suggestedAmounts: z.array(z.coerce.number().positive()).max(6).default([]),
  allowCustomAmount: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  translations: translationsRecord(campaignTranslationSchema),
})

export const pageInputSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, digits and dashes'),
  status: publishStatus.default('draft'),
  showInSitemap: z.boolean().default(true),
  blocks: blocksSchema.default([]),
  translations: translationsRecord(pageTranslationSchema),
})

export const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  color: z.string().trim().max(20).optional(),
  sortOrder: z.coerce.number().int().default(0),
  translations: z.object({
    en: z.object({ name: z.string().trim().max(120), slug: z.string().trim().max(120) }).optional(),
    fr: z.object({ name: z.string().trim().max(120), slug: z.string().trim().max(120) }).optional(),
    it: z.object({ name: z.string().trim().max(120), slug: z.string().trim().max(120) }).optional(),
    de: z.object({ name: z.string().trim().max(120), slug: z.string().trim().max(120) }).optional(),
    lg: z.object({ name: z.string().trim().max(120), slug: z.string().trim().max(120) }).optional(),
  }),
})

export const manualDonationSchema = z.object({
  amount: z.preprocess(parseAmount, z.number().positive()),
  currency: z.string().trim().length(3),
  campaignId: z.string().uuid().nullish(),
  donorName: z.string().trim().max(160).optional(),
  donorEmail: z.string().trim().max(254).optional(),
  donorOrganisation: z.string().trim().max(160).optional(),
  reference: z.string().trim().max(60).optional(),
  adminNote: z.string().trim().max(500).optional(),
  locale: z.enum(locales).default('en'),
  markAsReceived: z.boolean().default(true),
})

export type PostInput = z.infer<typeof postInputSchema>
export type ProjectInput = z.infer<typeof projectInputSchema>
export type CampaignInput = z.infer<typeof campaignInputSchema>
export type PageInput = z.infer<typeof pageInputSchema>
export type CategoryInput = z.infer<typeof categoryInputSchema>
