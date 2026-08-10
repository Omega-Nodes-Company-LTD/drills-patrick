import { describe, expect, it } from 'vitest'
import { applicableRates, buildQuote } from '@/lib/ngo/quotes'
import type { DrillingRateRow } from '@/db/schema'

const rate = (partial: Partial<DrillingRateRow>): DrillingRateRow =>
  ({
    id: crypto.randomUUID(),
    label: 'Band',
    depthFromM: 0,
    depthToM: 1000,
    geology: 'any',
    ratePerMetreMinor: 0,
    fixedCostMinor: 0,
    currency: 'UGX',
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }) as DrillingRateRow

const shallow = rate({ label: '0–30 m', depthToM: 30, ratePerMetreMinor: 100_000 })
const deep = rate({ label: '30–80 m', depthFromM: 30, depthToM: 80, ratePerMetreMinor: 160_000 })
const basement = rate({
  label: '30–80 m basement',
  depthFromM: 30,
  depthToM: 80,
  geology: 'basement',
  ratePerMetreMinor: 240_000,
})
const mobilisation = rate({ label: 'Mobilisation', fixedCostMinor: 4_000_000 })

describe('quote engine', () => {
  it('bills each depth band at its own rate', () => {
    // 60 m is not 60 × the shallow rate: the first 30 m are cheaper than the
    // rest, which is how the job is actually priced.
    const quote = buildQuote([shallow, deep], { depthM: 60, geology: 'any', wellsCount: 1 })

    expect(quote.subtotalMinor).toBe(30 * 100_000 + 30 * 160_000)
    expect(quote.lines).toHaveLength(2)
  })

  it('prefers an exact geology match over the catch-all', () => {
    const applicable = applicableRates([deep, basement], { depthM: 60, geology: 'basement' })
    expect(applicable[0]!.geology).toBe('basement')
  })

  it('multiplies metres by the number of wells but keeps fixed costs per well', () => {
    const quote = buildQuote([shallow, mobilisation], {
      depthM: 20,
      geology: 'any',
      wellsCount: 3,
    })

    const metres = quote.lines.find((line) => line.label === '0–30 m')!
    const fixed = quote.lines.find((line) => line.label.includes('fixed'))!

    expect(metres.quantity).toBe(60)
    expect(fixed.quantity).toBe(3)
  })

  it('reports an incomplete quote rather than a price of zero', () => {
    // A gap in the rate table must not read as "free".
    expect(buildQuote([], { depthM: 60, geology: 'any', wellsCount: 1 }).incomplete).toBe(true)
    expect(
      buildQuote([rate({ depthFromM: 200 })], { depthM: 60, geology: 'any', wellsCount: 1 })
        .incomplete,
    ).toBe(true)
  })

  it('ignores rates that were switched off', () => {
    const quote = buildQuote([{ ...shallow, isActive: false }], {
      depthM: 20,
      geology: 'any',
      wellsCount: 1,
    })
    expect(quote.incomplete).toBe(true)
  })
})
