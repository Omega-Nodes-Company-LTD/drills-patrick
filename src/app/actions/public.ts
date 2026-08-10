'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  contactSubmissions,
  faultReports,
  newsletterSubscribers,
  ngoInquiries,
  projects,
} from '@/db/schema'
import { faultReference } from '@/lib/ngo/faults'
import { toMinorUnits } from '@/lib/money'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import {
  notifyContactSubmission,
  notifyFaultReported,
  notifyNgoInquiry,
} from '@/lib/mail/notifications'
import {
  contactSchema,
  newsletterSchema,
  ngoInquirySchema,
  type ActionResult,
} from '@/lib/validation/public'

/**
 * Public form endpoints. All of them are rate limited per IP and carry a
 * honeypot field; failures return a plain result object so the forms can show
 * a translated message rather than a stack trace.
 */

async function guard(scope: string, limit = 5): Promise<boolean> {
  const ip = await clientIdentifier()
  return rateLimit(`${scope}:${ip}`, { limit, windowMs: 10 * 60 * 1000 }).ok
}

export async function subscribeNewsletter(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = newsletterSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'invalid' }
  if (parsed.data.website) return { ok: true } // honeypot: pretend success

  if (!(await guard('newsletter'))) return { ok: false, error: 'rate_limited' }

  const email = parsed.data.email.toLowerCase()

  const [existing] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1)

  if (existing) {
    return existing.unsubscribedAt
      ? await resubscribe(email)
      : { ok: false, error: 'already_subscribed' }
  }

  await db.insert(newsletterSubscribers).values({
    email,
    name: parsed.data.name || null,
    locale: parsed.data.locale,
    confirmToken: crypto.randomUUID(),
  })

  return { ok: true }
}

async function resubscribe(email: string): Promise<ActionResult> {
  await db
    .update(newsletterSubscribers)
    .set({ unsubscribedAt: null })
    .where(eq(newsletterSubscribers.email, email))
  return { ok: true }
}

export async function submitContact(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }
  if (parsed.data.website) return { ok: true }

  if (!(await guard('contact', 3))) return { ok: false, error: 'rate_limited' }

  await db.insert(contactSubmissions).values({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone || null,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
    locale: parsed.data.locale,
  })

  await notifyContactSubmission(parsed.data)

  return { ok: true }
}

export async function submitNgoInquiry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData)
  // Empty numeric inputs arrive as '' and would fail coercion.
  for (const key of ['wellsRequested', 'beneficiariesEstimate', 'budget'] as const) {
    if (raw[key] === '') delete raw[key]
  }

  const parsed = ngoInquirySchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }
  if (parsed.data.website) return { ok: true }

  if (!(await guard('inquiry', 3))) return { ok: false, error: 'rate_limited' }

  const currency = parsed.data.currency?.toUpperCase()

  await db.insert(ngoInquiries).values({
    organisationName: parsed.data.organisationName,
    contactName: parsed.data.contactName,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone || null,
    country: parsed.data.country || null,
    region: parsed.data.region || null,
    interventionType: parsed.data.interventionType || null,
    wellsRequested: parsed.data.wellsRequested ?? null,
    beneficiariesEstimate: parsed.data.beneficiariesEstimate ?? null,
    budgetMinor:
      parsed.data.budget != null && currency ? toMinorUnits(parsed.data.budget, currency) : null,
    currency: currency ?? null,
    timeframe: parsed.data.timeframe || null,
    message: parsed.data.message,
    locale: parsed.data.locale,
    source: 'website',
  })

  await notifyNgoInquiry(parsed.data)

  return { ok: true }
}

// ------------------------------------------------------------- fault reports

const faultSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().trim().min(5).max(2000),
  symptom: z.string().trim().max(120).optional(),
  reporterName: z.string().trim().max(120).optional(),
  reporterPhone: z.string().trim().max(40).optional(),
  website: z.string().max(0).optional(),
})

/**
 * A fault reported from the field.
 *
 * No account, no app: the QR sticker on the well cover opens this form. The
 * people who notice a broken pump first are the ones fetching water from it,
 * and any step between them and the report is a step where it stops.
 */
export async function reportFault(
  _prev: ActionResult<{ reference: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ reference: string }>> {
  const parsed = faultSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }
  if (parsed.data.website) return { ok: true, data: { reference: '' } }

  // Looser than the contact form: a village with one shared phone should not
  // be locked out because a neighbour reported a different well an hour ago.
  if (!(await guard('fault', 10))) return { ok: false, error: 'rate_limited' }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), eq(projects.publishStatus, 'published')))
    .limit(1)

  if (!project) return { ok: false, error: 'invalid' }

  const reference = faultReference()

  await db.insert(faultReports).values({
    projectId: project.id,
    reference,
    description: parsed.data.description,
    symptom: parsed.data.symptom || null,
    reporterName: parsed.data.reporterName || null,
    reporterPhone: parsed.data.reporterPhone || null,
  })

  await notifyFaultReported({ reference, projectId: project.id, description: parsed.data.description })

  return { ok: true, data: { reference } }
}
