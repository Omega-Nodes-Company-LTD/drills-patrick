import 'server-only'
import { createHash } from 'node:crypto'
import type { ProjectDocumentRow } from '@/db/schema'

/**
 * Witnessed signatures on a handover certificate.
 *
 * This is **not** a qualified electronic signature. There is no certificate
 * authority behind it and no eIDAS equivalence: what it records is that a
 * named person drew a signature at a stated time against a document whose
 * contents hashed to a specific value. If the document is edited afterwards,
 * the hash no longer matches and the signature reads as stale rather than
 * silently continuing to endorse different text.
 *
 * That is the honest description of what a canvas and a hash can give. Full
 * legal equivalence needs a provider, and the PR that introduced this says so.
 */

/** The fields a signature commits to. Order is fixed: it is part of the hash. */
export function documentFingerprint(document: ProjectDocumentRow): string {
  const payload = [
    document.id,
    document.projectId,
    document.kind,
    document.title,
    document.description ?? '',
    document.issuedOn ?? '',
    document.mediaId ?? '',
  ].join('|')

  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/** True when the document still says what it said when it was signed. */
export function signatureMatches(document: ProjectDocumentRow, contentHash: string): boolean {
  return documentFingerprint(document) === contentHash
}

/** Rejects anything that is not a small PNG data URL drawn on a canvas. */
export function isSignatureImage(value: string): boolean {
  if (!value.startsWith('data:image/png;base64,')) return false
  // ~1 MB of base64 is far more than a signature stroke needs, and the limit
  // is what stops this becoming a file upload endpoint by another name.
  return value.length <= 1_400_000
}
