import { z } from 'zod'
import { locales } from '@/i18n/config'
import { parseAmount } from '@/lib/money'

export const donationProviderSchema = z.enum([
  'stripe',
  'paypal',
  'pesapal',
  'mtn',
  'airtel',
  'bank',
])

export const donationSchema = z.object({
  // Five languages share this field, so "1.234,56" and "1,234.56" both arrive.
  amount: z.preprocess(parseAmount, z.number().positive().max(10_000_000)),
  currency: z.string().trim().length(3),
  provider: donationProviderSchema,
  campaignId: z.string().uuid().optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  donorName: z.string().trim().max(120).optional(),
  donorEmail: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^@\s]+@[^@\s.]+\.[^@\s]+$/, 'Enter a valid email address')
    .optional()
    .or(z.literal('')),
  donorPhone: z.string().trim().max(40).optional(),
  donorOrganisation: z.string().trim().max(160).optional(),
  donorCountry: z.string().trim().max(80).optional(),
  isAnonymous: z.coerce.boolean().default(false),
  message: z.string().trim().max(1000).optional(),
  locale: z.enum(locales).default('en'),
  /** Slug of the supporter page this gift came in through. */
  fundraiser: z.string().trim().max(160).optional(),
  /**
   * Opt-in to the public supporter wall. Separate from `isAnonymous`: not
   * wanting to be listed is a different decision from wanting the gift kept
   * private, and neither may default to yes.
   */
  showOnWall: z.coerce.boolean().default(false),
  wallDisplayName: z.string().trim().max(120).optional(),
  /** Solidarity gift: a card for someone else. */
  isGift: z.coerce.boolean().default(false),
  giftRecipientName: z.string().trim().max(120).optional(),
  giftRecipientEmail: z.string().trim().max(254).optional(),
  giftSenderName: z.string().trim().max(120).optional(),
  giftMessage: z.string().trim().max(1000).optional(),
  giftOccasion: z.string().trim().max(80).optional(),
  giftDeliverOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  website: z.string().max(0).optional(),
})

export type DonationInput = z.infer<typeof donationSchema>

export type DonationStartResult =
  | { ok: true; kind: 'redirect'; url: string }
  | { ok: true; kind: 'pending'; reference: string }
  | { ok: true; kind: 'instructions'; reference: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
