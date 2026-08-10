import { describe, expect, it } from 'vitest'
import { documentFingerprint, isSignatureImage, signatureMatches } from '@/lib/ngo/signatures'
import type { ProjectDocumentRow } from '@/db/schema'

const document = {
  id: 'doc-1',
  projectId: 'project-1',
  kind: 'handover',
  title: 'Handover certificate',
  description: 'Kayunga borehole',
  issuedOn: '2026-03-01',
  mediaId: 'media-1',
} as ProjectDocumentRow

describe('document signatures', () => {
  it('detects a document edited after it was signed', () => {
    // The point of the hash: an endorsement must not survive a change to what
    // was endorsed.
    const hash = documentFingerprint(document)
    expect(signatureMatches(document, hash)).toBe(true)

    const edited = { ...document, title: 'Handover certificate (revised)' } as ProjectDocumentRow
    expect(signatureMatches(edited, hash)).toBe(false)
  })

  it('hashes the same document to the same value', () => {
    expect(documentFingerprint(document)).toBe(documentFingerprint({ ...document }))
  })

  it('separates fields so a shifted boundary changes the hash', () => {
    const shifted = { ...document, title: 'Handover', description: 'certificateKayunga borehole' }
    expect(documentFingerprint(shifted as ProjectDocumentRow)).not.toBe(
      documentFingerprint(document),
    )
  })

  it('accepts only a small PNG data URL', () => {
    expect(isSignatureImage('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isSignatureImage('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isSignatureImage('https://example.test/signature.png')).toBe(false)
    expect(isSignatureImage(`data:image/png;base64,${'A'.repeat(2_000_000)}`)).toBe(false)
  })
})
