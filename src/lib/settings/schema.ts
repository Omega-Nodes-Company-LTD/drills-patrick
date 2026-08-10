import { z } from 'zod'
import { locales } from '@/i18n/config'
import { i18nRichTextSchema, i18nTextSchema } from '@/i18n/schema'

/** Structured JSON columns of `site_settings`, all editable from the admin. */

export const socialLinksSchema = z.object({
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  x: z.string().optional(),
  youtube: z.string().optional(),
  whatsapp: z.string().optional(),
})

export const contactInfoSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  phoneAlt: z.string().optional(),
  addressLines: z.array(z.string()).default([]),
  city: z.string().optional(),
  country: z.string().default('Uganda'),
  mapLat: z.number().nullish(),
  mapLng: z.number().nullish(),
  openingHours: i18nTextSchema.optional(),
})

export const seoSettingsSchema = z.object({
  metaTitle: i18nTextSchema.optional(),
  metaDescription: i18nTextSchema.optional(),
  keywords: z.array(z.string()).default([]),
  twitterHandle: z.string().optional(),
  plausibleDomain: z.string().optional(),
  googleAnalyticsId: z.string().optional(),
  googleSiteVerification: z.string().optional(),
})

/** Bank details rendered on the bank-transfer donation option. */
export const bankTransferSchema = z.object({
  accountName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  branch: z.string().optional(),
  instructions: i18nRichTextSchema.optional(),
})

export const donationSettingsSchema = z.object({
  defaultCurrency: z.string().length(3).default('EUR'),
  currencies: z.array(z.string().length(3)).min(1).default(['EUR', 'USD', 'UGX']),
  suggestedAmounts: z.record(z.string(), z.array(z.number().int().positive())).default({
    EUR: [25, 50, 100, 250],
    USD: [25, 50, 100, 250],
    UGX: [50000, 100000, 250000, 500000],
  }),
  minAmount: z.record(z.string(), z.number().int().positive()).default({
    EUR: 5,
    USD: 5,
    UGX: 10000,
  }),
  allowRecurring: z.boolean().default(false),
  receiptPrefix: z.string().default('PW'),
  thankYouMessage: i18nRichTextSchema.optional(),
})

export const featureTogglesSchema = z.object({
  blog: z.boolean().default(true),
  projects: z.boolean().default(true),
  donations: z.boolean().default(true),
  newsletter: z.boolean().default(true),
  chatAssistant: z.boolean().default(true),
  semanticSearch: z.boolean().default(true),
})

export const organisationSchema = z.object({
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  foundedYear: z.number().int().nullish(),
  /**
   * Public pages that confirm the organisation exists — the NGO board entry,
   * a donor's partner directory, a charity register. They become `sameAs` in
   * the structured data, which is how a search or answer engine ties the site
   * to a body that vouches for it. Entered by the operator; nothing is guessed.
   */
  registryUrls: z.array(z.string()).default([]),
})

export type SocialLinks = z.infer<typeof socialLinksSchema>
export type ContactInfo = z.infer<typeof contactInfoSchema>
export type SeoSettings = z.infer<typeof seoSettingsSchema>
export type BankTransferDetails = z.infer<typeof bankTransferSchema>
export type DonationSettings = z.infer<typeof donationSettingsSchema>
export type FeatureToggles = z.infer<typeof featureTogglesSchema>
export type OrganisationDetails = z.infer<typeof organisationSchema>

export const localeListSchema = z.array(z.enum(locales)).min(1)

/** Navigation menus (header, footer columns, legal bar). */
export const navItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: i18nTextSchema,
    href: z.string(),
    external: z.boolean().default(false),
    highlight: z.boolean().default(false),
    children: z.array(navItemSchema).default([]),
  }),
)

export type NavItem = {
  id: string
  label: z.infer<typeof i18nTextSchema>
  href: string
  external: boolean
  highlight: boolean
  children: NavItem[]
}

export const navItemsSchema = z.array(navItemSchema)

export function parseNavItems(value: unknown): NavItem[] {
  const parsed = navItemsSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}
