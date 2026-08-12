import { describe, expect, it } from 'vitest'
import { blocksSchema, teamBlockSchema } from '@/lib/blocks/schema'
import { initialsOf } from '@/lib/content/initials'

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Grace Nabukenya')).toBe('GN')
    expect(initialsOf('Patrick Ssebunya Kato')).toBe('PS')
  })

  it('ignores a bracketed marker rather than reading it as a name', () => {
    // Placeholder rows are seeded as "[DEMO] Grace Nabukenya"; "[G" would be
    // the obvious wrong answer here.
    expect(initialsOf('[DEMO] Grace Nabukenya')).toBe('GN')
  })

  it('handles a single name', () => {
    expect(initialsOf('Nakato')).toBe('N')
  })

  it('falls back to a placeholder rather than an empty frame', () => {
    expect(initialsOf('[DEMO]')).toBe('·')
    expect(initialsOf('  ')).toBe('·')
  })

  it('reads non-Latin scripts', () => {
    expect(initialsOf('Даниил Ковач')).toBe('ДК')
  })
})

describe('team block schema', () => {
  const minimal = { id: 'a', kind: 'team' as const, layout: {} }

  it('fills the defaults an editor would otherwise have to set', () => {
    const parsed = teamBlockSchema.parse(minimal)
    expect(parsed.memberIds).toEqual([])
    expect(parsed.columns).toBe(3)
    expect(parsed.showBio).toBe(true)
    expect(parsed.showCredentials).toBe(true)
    expect(parsed.showContact).toBe(true)
    expect(parsed.enabled).toBe(true)
  })

  it('is reachable through the block union, so a page can hold one', () => {
    const parsed = blocksSchema.parse([minimal])
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.kind).toBe('team')
  })

  it('rejects a column count the grid has no class for', () => {
    expect(teamBlockSchema.safeParse({ ...minimal, columns: 5 }).success).toBe(false)
    expect(teamBlockSchema.safeParse({ ...minimal, columns: 1 }).success).toBe(false)
  })

  it('rejects member ids that are not uuids', () => {
    expect(teamBlockSchema.safeParse({ ...minimal, memberIds: ['nope'] }).success).toBe(false)
  })
})
