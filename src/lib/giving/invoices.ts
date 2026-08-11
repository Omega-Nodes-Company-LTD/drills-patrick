import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { corporateSponsors, donations, invoices, siteSettings } from '@/db/schema'
import { invoiceAmountsFromGross, invoiceNumber, invoicingReady } from '@/lib/giving/invoicing'
import { getMediaByIds } from '@/lib/media/service'
import { getSiteSettings, revalidateSettings } from '@/lib/settings/service'
import { invoicingSettingsSchema } from '@/lib/settings/schema'

/**
 * Issuing an invoice for a corporate gift.
 *
 * The one rule that matters: a number is never reused and never skipped. A gap
 * or a duplicate in an invoice series is what a tax inspection is looking for,
 * so the sequence is claimed inside a transaction that also writes the row —
 * two people clicking at once get consecutive numbers, and a failure after the
 * claim rolls the number back rather than burning it.
 */

export type IssueInvoiceInput = {
  donationId?: string | null
  sponsorId?: string | null
  billToName: string
  billToVat?: string | null
  billToAddress?: string | null
  billToCountry?: string | null
  description?: string | null
  grossMinor: number
  currency: string
  issuedOn?: string
}

export type IssueResult =
  | { ok: true; id: string; number: string }
  | { ok: false; error: 'not_configured' | 'invalid' }

export async function issueInvoice(input: IssueInvoiceInput): Promise<IssueResult> {
  const settings = await getSiteSettings()
  if (!invoicingReady(settings.invoicing)) return { ok: false, error: 'not_configured' }
  if (input.grossMinor <= 0 || !input.billToName.trim()) return { ok: false, error: 'invalid' }

  const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10)
  const year = Number(issuedOn.slice(0, 4))
  const config = settings.invoicing

  const amounts = invoiceAmountsFromGross(input.grossMinor, config.taxRateBp)

  const created = await db.transaction(async (tx) => {
    // Re-read inside the transaction and lock the row: the settings copy above
    // came from a cache, and two concurrent issues must not both see the same
    // next number.
    const [row] = await tx
      .select({ invoicing: siteSettings.invoicing })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .for('update')
      .limit(1)

    const current = invoicingSettingsSchema.parse(row?.invoicing ?? {})
    const sequence = current.nextSequence

    const number = invoiceNumber({
      series: current.series,
      year,
      sequence,
      padding: current.sequencePadding,
    })

    const [invoice] = await tx
      .insert(invoices)
      .values({
        number,
        series: current.series,
        sequence,
        year,
        donationId: input.donationId || null,
        sponsorId: input.sponsorId || null,
        issuedOn,
        billToName: input.billToName.trim(),
        billToVat: input.billToVat || null,
        billToAddress: input.billToAddress || '',
        billToCountry: input.billToCountry || null,
        description: input.description || current.description || '',
        netMinor: amounts.netMinor,
        taxRateBp: amounts.taxRateBp,
        taxMinor: amounts.taxMinor,
        grossMinor: amounts.grossMinor,
        currency: input.currency.toUpperCase(),
        taxNote: current.taxNote || null,
      })
      .returning({ id: invoices.id, number: invoices.number })

    await tx
      .update(siteSettings)
      .set({ invoicing: { ...current, nextSequence: sequence + 1 } })
      .where(eq(siteSettings.id, 1))

    return invoice!
  })

  revalidateSettings()
  return { ok: true, id: created.id, number: created.number }
}

/**
 * Voids an invoice.
 *
 * Marked rather than deleted, and the number is not returned to the pool: a
 * missing number in a series looks exactly like a hidden one, and "issued then
 * voided, here is why" is the only version an auditor accepts.
 */
export async function voidInvoice(id: string, reason: string): Promise<boolean> {
  const result = await db
    .update(invoices)
    .set({ voidedAt: new Date(), voidReason: reason, updatedAt: new Date() })
    .where(and(eq(invoices.id, id), sql`${invoices.voidedAt} is null`))
    .returning({ id: invoices.id })

  return result.length > 0
}

export async function adminListInvoices(limit = 200) {
  return db.select().from(invoices).orderBy(desc(invoices.issuedOn), desc(invoices.sequence)).limit(limit)
}

export async function getInvoice(id: string) {
  const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1)
  return row ?? null
}

/** Sponsors shown on a project, logos resolved, in the order the operator set. */
export async function projectSponsors(projectId: string) {
  const rows = await db
    .select()
    .from(corporateSponsors)
    .where(
      and(eq(corporateSponsors.projectId, projectId), eq(corporateSponsors.isPublished, true)),
    )
    .orderBy(corporateSponsors.sortOrder)

  if (rows.length === 0) return []

  // Resolved here rather than left to the component: a sponsor placement paid
  // for with a logo that silently renders as plain text is a broken agreement.
  const logos = await getMediaByIds(rows.map((row) => row.logoId).filter(Boolean) as string[])

  return rows.map((row) => ({
    ...row,
    logo: row.logoId ? (logos.get(row.logoId) ?? null) : null,
  }))
}

export async function adminListSponsors() {
  return db.select().from(corporateSponsors).orderBy(corporateSponsors.sortOrder).limit(300)
}

/** Corporate gifts with no invoice yet, which is what the office chases. */
export async function uninvoicedCorporateGifts(limit = 50) {
  return db
    .select({
      id: donations.id,
      reference: donations.reference,
      donorOrganisation: donations.donorOrganisation,
      donorName: donations.donorName,
      donorEmail: donations.donorEmail,
      donorCountry: donations.donorCountry,
      amountMinor: donations.amountMinor,
      currency: donations.currency,
      createdAt: donations.createdAt,
    })
    .from(donations)
    .where(
      and(
        eq(donations.status, 'succeeded'),
        sql`${donations.donorOrganisation} is not null and trim(${donations.donorOrganisation}) <> ''`,
        sql`not exists (select 1 from ${invoices} where ${invoices.donationId} = ${donations.id})`,
      ),
    )
    .orderBy(desc(donations.createdAt))
    .limit(limit)
}
