'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { siteSettings } from '@/db/schema'
import { locales } from '@/i18n/config'
import { i18nTextSchema } from '@/i18n/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { checkEmbeddingsConnection } from '@/lib/embeddings/client'
import { verifyMailConnection } from '@/lib/mail/mailer'
import {
  bankTransferSchema,
  invoicingSettingsSchema,
  contactInfoSchema,
  donationSettingsSchema,
  featureTogglesSchema,
  organisationSchema,
  seoSettingsSchema,
  socialLinksSchema,
} from '@/lib/settings/schema'
import { revalidateSettings } from '@/lib/settings/service'
import { checkStorageConnection } from '@/lib/storage/s3'
import type { ActionResult } from '@/lib/validation/public'

const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(120),
  tagline: i18nTextSchema,
  description: i18nTextSchema,
  logoLightId: z.string().uuid().nullish(),
  logoDarkId: z.string().uuid().nullish(),
  faviconId: z.string().uuid().nullish(),
  ogImageId: z.string().uuid().nullish(),
  defaultLocale: z.enum(locales),
  enabledLocales: z.array(z.enum(locales)).min(1),
  contact: contactInfoSchema,
  social: socialLinksSchema,
  seo: seoSettingsSchema,
  organisation: organisationSchema,
  bankTransfer: bankTransferSchema,
  donations: donationSettingsSchema,
  invoicing: invoicingSettingsSchema,
  features: featureTogglesSchema,
})

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const user = await requireApiUser('settings')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  const data = parsed.data

  // The default locale must be one of the active ones.
  if (!data.enabledLocales.includes(data.defaultLocale)) {
    return { ok: false, error: 'invalid', fieldErrors: { defaultLocale: 'not_enabled' } }
  }

  // The invoice counter is advanced by issuing invoices, not by this form.
  // An admin who opened this page before an invoice was issued would otherwise
  // save a stale number and hand the next invoice a duplicate — which is the
  // one thing an invoice series must never contain. Only forward moves stick.
  const [existing] = await db
    .select({ invoicing: siteSettings.invoicing })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)

  const storedSequence = existing?.invoicing?.nextSequence ?? 1
  const values = {
    ...data,
    invoicing: {
      ...data.invoicing,
      nextSequence: Math.max(data.invoicing.nextSequence, storedSequence),
    },
  }

  await db
    .insert(siteSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: siteSettings.id, set: values })

  await recordAudit({ actor: user, action: 'settings.update', entityType: 'settings' })

  revalidateSettings()
  return { ok: true }
}

/** "Test connection" buttons in the integrations panel. */
export async function testIntegration(
  target: 'storage' | 'embeddings' | 'mail',
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireApiUser('settings')
  if (!user) return { ok: false, error: 'unauthorised' }

  switch (target) {
    case 'storage':
      return checkStorageConnection()
    case 'embeddings':
      return checkEmbeddingsConnection()
    case 'mail':
      return verifyMailConnection()
  }
}
