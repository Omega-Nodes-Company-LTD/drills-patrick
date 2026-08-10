import { describe, expect, it } from 'vitest'
import { pickI18n } from '@/i18n/config'
import { pickTranslation } from '@/lib/content/translations'
import { parseBlocks } from '@/lib/blocks/schema'
import { htmlToPlainText, slugify, percentage, truncate } from '@/lib/utils'
import { parseThemeTokens, themeToCss } from '@/lib/theme/tokens'

describe('slugify', () => {
  it('normalises accents and spacing', () => {
    expect(slugify('Forage à Nyumanzi')).toBe('forage-a-nyumanzi')
    expect(slugify('  Multiple   spaces  ')).toBe('multiple-spaces')
    expect(slugify('Ünüsual — Chars!')).toBe('unusual-chars')
  })
})

describe('i18n fallbacks', () => {
  it('falls back to the default locale, then to anything present', () => {
    expect(pickI18n({ en: 'Water', it: 'Acqua' }, 'it')).toBe('Acqua')
    expect(pickI18n({ en: 'Water' }, 'lg')).toBe('Water')
    expect(pickI18n({ fr: 'Eau' }, 'de')).toBe('Eau')
    expect(pickI18n(undefined, 'en')).toBe('')
  })

  it('picks the requested translation row before the default one', () => {
    const rows = [
      { locale: 'en', title: 'English' },
      { locale: 'fr', title: 'Français' },
    ]
    expect(pickTranslation(rows, 'fr')?.title).toBe('Français')
    expect(pickTranslation(rows, 'de')?.title).toBe('English')
    expect(pickTranslation([], 'en')).toBeUndefined()
  })
})

describe('parseBlocks', () => {
  it('keeps valid blocks and drops broken ones', () => {
    const blocks = parseBlocks([
      {
        id: 'a',
        kind: 'richText',
        enabled: true,
        layout: { paddingTop: 'lg', paddingBottom: 'lg', width: 'narrow', tone: 'default' },
        content: { en: '<p>Hi</p>' },
      },
      { id: 'b', kind: 'nonsense' },
      null,
    ])

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.kind).toBe('richText')
  })

  it('returns an empty array for non-array input', () => {
    expect(parseBlocks(null)).toEqual([])
    expect(parseBlocks({})).toEqual([])
  })
})

describe('theme tokens', () => {
  it('falls back to defaults when the stored value is unusable', () => {
    const tokens = parseThemeTokens({ colors: { light: { primary: 'not-a-colour' } } })
    expect(tokens.colors.light.primary).toMatch(/^#/)
    expect(tokens.spacing.sectionY.lg).toBeGreaterThan(0)
  })

  it('emits variables under the prefixed namespace Tailwind maps onto', () => {
    const css = themeToCss(parseThemeTokens({}))
    expect(css).toContain('--c-primary')
    expect(css).toContain('--section-y-lg')
    expect(css).toContain('prefers-color-scheme: dark')
  })
})

describe('text helpers', () => {
  it('extracts readable text from HTML', () => {
    expect(htmlToPlainText('<p>One</p><p>Two</p>')).toBe('One\nTwo')
    expect(htmlToPlainText('<script>bad()</script><p>Safe</p>')).toBe('Safe')
  })

  it('truncates on a character budget', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 10)).toBe('abc')
  })

  it('clamps progress percentages', () => {
    expect(percentage(50, 100)).toBe(50)
    expect(percentage(150, 100)).toBe(100)
    expect(percentage(10, 0)).toBe(0)
  })
})
