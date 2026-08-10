import { describe, expect, it } from 'vitest'
import { sanitizeHtml, toEmbedUrl } from '@/lib/sanitize'

describe('sanitizeHtml', () => {
  it('keeps ordinary editorial markup', () => {
    const html = '<p>Water <strong>for</strong> <em>everyone</em></p><ul><li>One</li></ul>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('strips scripts and event handlers', () => {
    const dirty = '<p onclick="steal()">Hi</p><script>alert(1)</script>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
    expect(clean).toContain('Hi')
  })

  it('drops javascript: URLs', () => {
    // eslint-disable-next-line no-script-url -- deliberately hostile input
    const clean = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(clean).not.toContain('javascript:')
  })

  it('adds safe rel attributes to external links', () => {
    const clean = sanitizeHtml('<a href="https://example.org">x</a>')
    expect(clean).toContain('rel="noreferrer noopener"')
    expect(clean).toContain('target="_blank"')
  })

  it('leaves internal links untouched', () => {
    expect(sanitizeHtml('<a href="/projects">x</a>')).toBe('<a href="/projects">x</a>')
  })

  it('keeps only alignment among inline styles', () => {
    const clean = sanitizeHtml('<p style="text-align:center;position:fixed">x</p>')
    expect(clean).toContain('text-align:center')
    expect(clean).not.toContain('position')
  })
})

describe('toEmbedUrl', () => {
  it('converts YouTube watch links', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123',
    )
  })

  it('converts short YouTube links', () => {
    expect(toEmbedUrl('https://youtu.be/abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123',
    )
  })

  it('rejects unknown providers', () => {
    expect(toEmbedUrl('https://example.org/video')).toBeNull()
    expect(toEmbedUrl('not a url')).toBeNull()
  })
})
