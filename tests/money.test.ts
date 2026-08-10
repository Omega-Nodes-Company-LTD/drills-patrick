import { describe, expect, it } from 'vitest'
import {
  currencyExponent,
  formatMoney,
  fromMinorUnits,
  toMinorUnits,
} from '@/lib/money'

describe('minor units', () => {
  it('treats UGX as a zero-decimal currency', () => {
    expect(currencyExponent('UGX')).toBe(0)
    expect(toMinorUnits(50_000, 'UGX')).toBe(50_000)
    expect(fromMinorUnits(50_000, 'UGX')).toBe(50_000)
  })

  it('treats EUR as a two-decimal currency', () => {
    expect(currencyExponent('EUR')).toBe(2)
    expect(toMinorUnits(50, 'EUR')).toBe(5000)
    expect(fromMinorUnits(5000, 'EUR')).toBe(50)
  })

  it('rounds fractional input rather than truncating it', () => {
    expect(toMinorUnits(12.345, 'EUR')).toBe(1235)
    expect(toMinorUnits(0.005, 'EUR')).toBe(1)
  })

  it('is case insensitive on the currency code', () => {
    expect(currencyExponent('ugx')).toBe(0)
  })

  it('formats an amount in the requested locale', () => {
    // Non-breaking spaces vary by ICU build, so assert on the digits.
    expect(formatMoney(5000, 'EUR', 'it', { hideDecimals: true })).toContain('50')
    expect(formatMoney(50_000, 'UGX', 'en')).toContain('50,000')
  })
})
