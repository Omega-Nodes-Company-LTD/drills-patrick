import { describe, expect, it } from 'vitest'
import {
  formatTaxRate,
  invoiceAmountsFromGross,
  invoiceAmountsFromNet,
  invoiceNumber,
  invoicingReady,
} from '@/lib/giving/invoicing'
import { matchFor, pledgeIsOpen, pledgeProgress, remainingMinor } from '@/lib/giving/matching'
import { milestoneStates, nextMilestone } from '@/lib/giving/milestones'
import { advance, annualisedMinor, nextChargeAfter } from '@/lib/giving/schedule'
import { hashToken, issueToken, tokenMatches } from '@/lib/giving/tokens'

describe('invoice numbering', () => {
  it('pads the sequence so numbers sort as text', () => {
    expect(invoiceNumber({ series: 'DON', year: 2026, sequence: 7, padding: 4 })).toBe(
      'DON/2026/0007',
    )
    // 10 must sort after 9, which is the whole reason for the padding.
    const numbers = [9, 10].map((sequence) =>
      invoiceNumber({ series: 'DON', year: 2026, sequence, padding: 4 }),
    )
    expect([...numbers].sort()).toEqual(numbers)
  })

  it('drops the series when the operator has not named one', () => {
    expect(invoiceNumber({ series: '  ', year: 2026, sequence: 1, padding: 3 })).toBe('2026/001')
  })

  it('refuses to run without a series', () => {
    const base = {
      enabled: true,
      series: '',
      nextSequence: 1,
      sequencePadding: 4,
      taxRateBp: 0,
      taxNote: '',
      description: '',
      footer: '',
    }
    expect(invoicingReady(base)).toBe(false)
    expect(invoicingReady({ ...base, series: 'DON' })).toBe(true)
    expect(invoicingReady({ ...base, series: 'DON', enabled: false })).toBe(false)
  })
})

describe('invoice amounts', () => {
  it('treats what arrived as the gross, never invoicing more than was paid', () => {
    const amounts = invoiceAmountsFromGross(12_200, 2200)

    expect(amounts.grossMinor).toBe(12_200)
    expect(amounts.netMinor).toBe(10_000)
    expect(amounts.taxMinor).toBe(2_200)
  })

  it('always adds back to exactly what was received', () => {
    for (const gross of [1, 7, 99, 333, 1_234, 99_999, 1_000_003]) {
      for (const rate of [0, 400, 1000, 2200, 2500]) {
        const amounts = invoiceAmountsFromGross(gross, rate)
        expect(amounts.netMinor + amounts.taxMinor).toBe(gross)
      }
    }
  })

  it('charges nothing when the gift is outside the tax scope', () => {
    const amounts = invoiceAmountsFromGross(5_000, 0)
    expect(amounts).toEqual({ netMinor: 5_000, taxMinor: 0, grossMinor: 5_000, taxRateBp: 0 })
  })

  it('works forwards from a net figure too', () => {
    expect(invoiceAmountsFromNet(10_000, 2200)).toEqual({
      netMinor: 10_000,
      taxMinor: 2_200,
      grossMinor: 12_200,
      taxRateBp: 2200,
    })
  })

  it('prints half-point rates readably', () => {
    expect(formatTaxRate(2200)).toBe('22%')
    expect(formatTaxRate(0)).toBe('0%')
    expect(formatTaxRate(2250)).toBe('22.5%')
  })
})

describe('matching gift', () => {
  const base = {
    ratioBp: 10_000,
    ceilingMinor: 100_000,
    perDonationCapMinor: null,
    matchedMinor: 0,
    currency: 'EUR',
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2026-12-31T23:59:59Z'),
    isActive: true,
  }
  const during = new Date('2026-06-01T12:00:00Z')

  it('doubles a gift at 1:1', () => {
    expect(matchFor(base, { amountMinor: 5_000, currency: 'EUR' }, during)).toBe(5_000)
  })

  it('honours a ratio below one', () => {
    expect(matchFor({ ...base, ratioBp: 5_000 }, { amountMinor: 5_000, currency: 'EUR' }, during)).toBe(
      2_500,
    )
  })

  it('respects a per-gift cap', () => {
    const pledge = { ...base, perDonationCapMinor: 1_000 }
    expect(matchFor(pledge, { amountMinor: 50_000, currency: 'EUR' }, during)).toBe(1_000)
  })

  it('never promises past the ceiling', () => {
    const nearlySpent = { ...base, matchedMinor: 99_000 }
    expect(matchFor(nearlySpent, { amountMinor: 50_000, currency: 'EUR' }, during)).toBe(1_000)

    const spent = { ...base, matchedMinor: 100_000 }
    expect(matchFor(spent, { amountMinor: 5_000, currency: 'EUR' }, during)).toBe(0)
  })

  it('matches nothing outside the agreed window', () => {
    expect(matchFor(base, { amountMinor: 5_000, currency: 'EUR' }, new Date('2025-12-31T00:00:00Z'))).toBe(0)
    expect(matchFor(base, { amountMinor: 5_000, currency: 'EUR' }, new Date('2027-01-01T00:00:00Z'))).toBe(0)
  })

  it('matches nothing in another currency, rather than guessing a rate', () => {
    expect(matchFor(base, { amountMinor: 5_000, currency: 'UGX' }, during)).toBe(0)
  })

  it('matches nothing once the pledge is switched off', () => {
    expect(matchFor({ ...base, isActive: false }, { amountMinor: 5_000, currency: 'EUR' }, during)).toBe(0)
  })

  it('reports what is left and how far along it is', () => {
    const half = { ...base, matchedMinor: 50_000 }
    expect(remainingMinor(half)).toBe(50_000)
    expect(pledgeProgress(half)).toBe(0.5)

    // A ceiling of zero must not divide by zero.
    expect(pledgeProgress({ ...base, ceilingMinor: 0 })).toBe(0)
    expect(remainingMinor({ ...base, matchedMinor: 200_000 })).toBe(0)
  })

  it('is closed once the ceiling is reached', () => {
    expect(pledgeIsOpen({ ...base, matchedMinor: 100_000 }, during)).toBe(false)
    expect(pledgeIsOpen(base, during)).toBe(true)
  })
})

describe('milestones', () => {
  const milestones = [
    { id: 'c', thresholdMinor: 300_000, label: 'Third', description: '' },
    { id: 'a', thresholdMinor: 100_000, label: 'First', description: '' },
    { id: 'b', thresholdMinor: 200_000, label: 'Second', description: '' },
  ]

  it('orders by threshold whatever order they were saved in', () => {
    expect(milestoneStates(milestones, 0).map((state) => state.id)).toEqual(['a', 'b', 'c'])
  })

  it('unlocks everything at or below the amount raised', () => {
    const states = milestoneStates(milestones, 200_000)
    expect(states.map((state) => state.unlocked)).toEqual([true, true, false])
    expect(states[2]!.remainingMinor).toBe(100_000)
  })

  it('measures progress from the previous step, not from zero', () => {
    // Halfway between the first and second milestone.
    const states = milestoneStates(milestones, 150_000)
    expect(states[1]!.progress).toBeCloseTo(0.5)
    // Measuring from zero would have made the third look 50% done.
    expect(states[2]!.progress).toBeCloseTo(0)
  })

  it('names the step being worked on', () => {
    expect(nextMilestone(milestoneStates(milestones, 150_000))?.id).toBe('b')
    expect(nextMilestone(milestoneStates(milestones, 999_999))).toBeNull()
  })

  it('copes with an empty list', () => {
    expect(milestoneStates([], 5_000)).toEqual([])
    expect(nextMilestone([])).toBeNull()
  })
})

describe('recurring schedule', () => {
  it('advances a month', () => {
    expect(advance(new Date('2026-01-15T00:00:00Z'), 'monthly')).toBe('2026-02-15')
    expect(advance(new Date('2026-01-15T00:00:00Z'), 'quarterly')).toBe('2026-04-15')
    expect(advance(new Date('2026-01-15T00:00:00Z'), 'yearly')).toBe('2027-01-15')
  })

  it('clamps into a short month instead of skipping it', () => {
    // The naive answer here is 3 March, which silently drops February.
    expect(advance(new Date('2026-01-31T00:00:00Z'), 'monthly')).toBe('2026-02-28')
    expect(advance(new Date('2028-01-31T00:00:00Z'), 'monthly')).toBe('2028-02-29')
  })

  it('returns to the agreed day after a short month', () => {
    // Anchored on the 31st: February clamps, March goes back.
    expect(advance(new Date('2026-02-28T00:00:00Z'), 'monthly', 31)).toBe('2026-03-31')
    // Without the anchor the gift would creep earlier every February.
    expect(advance(new Date('2026-02-28T00:00:00Z'), 'monthly')).toBe('2026-03-28')
  })

  it('crosses a year end', () => {
    expect(advance(new Date('2026-12-15T00:00:00Z'), 'monthly')).toBe('2027-01-15')
  })

  it('catches up rather than replaying six missed months', () => {
    const next = nextChargeAfter({
      from: new Date('2026-01-10T00:00:00Z'),
      interval: 'monthly',
      today: new Date('2026-07-05T00:00:00Z'),
    })

    // One charge ahead of today, not a backlog of six.
    expect(next).toBe('2026-07-10')
  })

  it('takes the next date when the plan is up to date', () => {
    expect(
      nextChargeAfter({
        from: new Date('2026-07-10T00:00:00Z'),
        interval: 'monthly',
        today: new Date('2026-07-11T00:00:00Z'),
      }),
    ).toBe('2026-08-10')
  })

  it('annualises whatever the interval is', () => {
    expect(annualisedMinor(1_000, 'monthly')).toBe(12_000)
    expect(annualisedMinor(1_000, 'quarterly')).toBe(4_000)
    expect(annualisedMinor(1_000, 'yearly')).toBe(1_000)
  })
})

describe('manage tokens', () => {
  it('never stores the token itself', () => {
    const { token, hash } = issueToken()
    expect(hash).not.toContain(token)
    expect(hash).toHaveLength(64)
  })

  it('is long enough not to be guessed', () => {
    expect(issueToken().token.length).toBeGreaterThanOrEqual(32)
  })

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => issueToken().token))
    expect(seen.size).toBe(200)
  })

  it('accepts the right token and rejects everything else', () => {
    const { token, hash } = issueToken()

    expect(tokenMatches(token, hash)).toBe(true)
    expect(tokenMatches(`${token}x`, hash)).toBe(false)
    expect(tokenMatches('', hash)).toBe(false)
    expect(tokenMatches(token, '')).toBe(false)
    // A malformed stored hash must return false, not throw.
    expect(tokenMatches(token, 'short')).toBe(false)
  })

  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })
})
