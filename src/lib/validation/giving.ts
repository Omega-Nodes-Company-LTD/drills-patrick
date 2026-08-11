import { z } from 'zod'
import { locales } from '@/i18n/config'
import { parseAmount } from '@/lib/money'
import { emailSchema } from '@/lib/validation/public'

/** Shared schemas for the supporter-facing giving forms. */

export const fundraiserStartSchema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: emailSchema,
  title: z.string().trim().min(4).max(160),
  story: z.string().trim().max(8000).default(''),
  campaignId: z.string().uuid().optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  goalAmount: z.preprocess(parseAmount, z.number().min(0).max(10_000_000)).default(0),
  currency: z.string().trim().length(3),
  endsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  locale: z.enum(locales).default('en'),
  website: z.string().max(0).optional(),
})

export const fundraiserEditSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  token: z.string().trim().min(10).max(200),
  title: z.string().trim().min(4).max(160),
  story: z.string().trim().max(8000).default(''),
  goalAmount: z.preprocess(parseAmount, z.number().min(0).max(10_000_000)).default(0),
  endsOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
})

export const legacyEnquirySchema = z.object({
  kind: z.enum(['legacy', 'major_gift', 'foundation', 'in_memory']).default('legacy'),
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  organisation: z.string().trim().max(160).optional(),
  preferredContact: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).default(''),
  locale: z.enum(locales).default('en'),
  website: z.string().max(0).optional(),
})

/**
 * What a donor may change on their own standing gift.
 *
 * Pausing and cancelling are unconditional: a donor who cannot find the pause
 * button cancels instead, and making them justify it costs the gift entirely.
 */
export const recurringManageSchema = z.object({
  reference: z.string().trim().min(4).max(60),
  token: z.string().trim().min(10).max(200),
  action: z.enum(['pause', 'resume', 'cancel', 'amount']),
  /** Only read for `amount`. */
  amount: z.preprocess(parseAmount, z.number().positive().max(10_000_000)).optional(),
  /** Only read for `pause`: resume automatically on this date. */
  resumeOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  reason: z.string().trim().max(500).optional(),
})

export type FundraiserStartInput = z.infer<typeof fundraiserStartSchema>
export type LegacyEnquiryInput = z.infer<typeof legacyEnquirySchema>
export type RecurringManageInput = z.infer<typeof recurringManageSchema>
