'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { documentSignatures, projectDocuments } from '@/db/schema'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { partnerProjectIds } from '@/lib/ngo/portal'
import { documentFingerprint, isSignatureImage } from '@/lib/ngo/signatures'
import type { ActionResult } from '@/lib/validation/public'

/**
 * A partner contact signing a handover certificate.
 *
 * The signature is bound to a hash of the document as it stood at that
 * moment, so editing the document afterwards makes the signature read as
 * stale instead of silently endorsing different text.
 */

const signSchema = z.object({
  documentId: z.string().uuid(),
  signerName: z.string().trim().min(1).max(160),
  signerRole: z.string().trim().max(160).optional(),
  signatureImage: z.string().min(1),
})

export async function signDocument(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getPartnerSession()
  if (!session) return { ok: false, error: 'unauthorised' }

  const parsed = signSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  if (!isSignatureImage(parsed.data.signatureImage)) return { ok: false, error: 'invalid_image' }

  // The document must belong to a project this partner can see. Checked here
  // rather than trusted from the page that rendered the pad.
  const allowed = await partnerProjectIds(session.partnerId)
  if (allowed.length === 0) return { ok: false, error: 'forbidden' }

  const [document] = await db
    .select()
    .from(projectDocuments)
    .where(
      and(
        eq(projectDocuments.id, parsed.data.documentId),
        inArray(projectDocuments.projectId, allowed),
      ),
    )
    .limit(1)

  if (!document) return { ok: false, error: 'forbidden' }

  const forwarded = (await headers()).get('x-forwarded-for')

  const [created] = await db
    .insert(documentSignatures)
    .values({
      documentId: document.id,
      signerName: parsed.data.signerName,
      signerRole: parsed.data.signerRole || null,
      signerOrganisation: session.partnerName,
      signatureImage: parsed.data.signatureImage,
      contentHash: documentFingerprint(document),
      ipAddress: forwarded?.split(',')[0]?.trim() ?? null,
    })
    .returning({ id: documentSignatures.id })

  revalidatePath('/[locale]/portal/documents', 'page')
  return { ok: true, data: { id: created!.id } }
}
