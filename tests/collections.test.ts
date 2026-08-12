import { describe, expect, it } from 'vitest'
import { schemaFor } from '@/lib/admin/collections'

/**
 * The admin form has no concept of "absent": every text-ish field starts life
 * as '', and an existing row with a NULL column is loaded the same way. The
 * validation has to accept that, because otherwise a record can only be saved
 * once it has a picture.
 */
describe('collection validation', () => {
  const teamBase = {
    name: 'Grace Nabukenya',
    photoId: '',
    email: '',
    linkedinUrl: '',
    credentials: '',
    isPublished: true,
  }
  const translations = { role: { en: 'Hydrogeologist' }, bio: { en: '' } }

  it('accepts a member with no photograph', () => {
    const result = schemaFor('team').safeParse({ sortOrder: 0, base: teamBase, translations })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.base.photoId).toBeNull()
  })

  it('still accepts a real media id', () => {
    const photoId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    const result = schemaFor('team').safeParse({
      sortOrder: 0,
      base: { ...teamBase, photoId },
      translations,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.base.photoId).toBe(photoId)
  })

  it('still rejects an id that is not a uuid', () => {
    const result = schemaFor('team').safeParse({
      sortOrder: 0,
      base: { ...teamBase, photoId: 'not-a-uuid' },
      translations,
    })
    expect(result.success).toBe(false)
  })

  it('applies to every collection carrying an image, not just team', () => {
    const partner = schemaFor('partner').safeParse({
      sortOrder: 0,
      base: { name: 'Sample Foundation', logoId: '', websiteUrl: '', tier: '', isPublished: true },
      translations: { description: { en: '' } },
    })
    expect(partner.success).toBe(true)

    const testimonial = schemaFor('testimonial').safeParse({
      sortOrder: 0,
      base: { authorName: 'David Kizza', organisation: '', photoId: '', isPublished: true },
      translations: { role: { en: '' }, quote: { en: 'It works.' } },
    })
    expect(testimonial.success).toBe(true)
  })

  it('still enforces required fields', () => {
    const result = schemaFor('team').safeParse({
      sortOrder: 0,
      base: { ...teamBase, name: '' },
      translations,
    })
    expect(result.success).toBe(false)
  })
})
