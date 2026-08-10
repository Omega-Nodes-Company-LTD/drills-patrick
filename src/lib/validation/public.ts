import { z } from 'zod'
import { locales } from '@/i18n/config'

/** Shared schemas for the public forms (used by the actions and the tests). */

export const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .regex(/^[^@\s]+@[^@\s.]+\.[^@\s]+$/, 'Enter a valid email address')

export const newsletterSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  locale: z.enum(locales).default('en'),
  // Honeypot: real users never fill this in.
  website: z.string().max(0).optional(),
})

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(locales).default('en'),
  website: z.string().max(0).optional(),
})

export const ngoInquirySchema = z.object({
  organisationName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  region: z.string().trim().max(120).optional(),
  interventionType: z.string().trim().max(60).optional(),
  wellsRequested: z.coerce.number().int().min(0).max(10000).optional(),
  beneficiariesEstimate: z.coerce.number().int().min(0).max(10_000_000).optional(),
  budget: z.coerce.number().min(0).max(1_000_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  timeframe: z.string().trim().max(40).optional(),
  message: z.string().trim().max(5000).default(''),
  locale: z.enum(locales).default('en'),
  website: z.string().max(0).optional(),
})

export type NewsletterInput = z.infer<typeof newsletterSchema>
export type ContactInput = z.infer<typeof contactSchema>
export type NgoInquiryInput = z.infer<typeof ngoInquirySchema>

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
