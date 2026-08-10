import { describe, expect, it } from 'vitest'
import { matchesDeclaredType, sanitizeSvg } from '@/lib/media/sniff'

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
])
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
const pdf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(16)])

describe('matchesDeclaredType', () => {
  it('accepts bytes that match the declared type', () => {
    expect(matchesDeclaredType(png, 'image/png')).toBe(true)
    expect(matchesDeclaredType(jpeg, 'image/jpeg')).toBe(true)
    expect(matchesDeclaredType(pdf, 'application/pdf')).toBe(true)
  })

  it('rejects a file lying about its type', () => {
    // The attack this covers: an HTML page uploaded as image/png would be
    // served from the bucket with a content type browsers render.
    expect(matchesDeclaredType(png, 'image/jpeg')).toBe(false)
    expect(matchesDeclaredType(Buffer.from('<!DOCTYPE html><html>…'), 'image/png')).toBe(false)
    expect(matchesDeclaredType(Buffer.from('<!DOCTYPE html><html>…'), 'image/svg+xml')).toBe(false)
  })

  it('accepts markup only when it really is an SVG', () => {
    expect(matchesDeclaredType(Buffer.from('<svg xmlns="…"><path/></svg>'), 'image/svg+xml')).toBe(
      true,
    )
    expect(matchesDeclaredType(Buffer.from('name,amount\nA,1\n'), 'text/csv')).toBe(true)
  })
})

describe('sanitizeSvg', () => {
  it('drops scripts and event handlers', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>' +
      '<rect width="10" height="10" onload="alert(2)"/></svg>'
    const clean = sanitizeSvg(dirty)

    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onload')
    expect(clean).toContain('<rect')
  })

  it('removes external references', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.test/x.svg#a"/></svg>',
    )
    expect(clean).not.toContain('evil.test')
  })

  it('keeps the shapes a logo is made of', () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="#0a6d8f"/></svg>',
    )
    expect(clean).toContain('viewBox="0 0 24 24"')
    expect(clean).toContain('d="M0 0h24v24H0z"')
    expect(clean).toContain('fill="#0a6d8f"')
  })
})
