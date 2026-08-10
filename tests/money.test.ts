import { describe, expect, it } from 'vitest'
import {
  currencyExponent,
  formatMoney,
  fromMinorUnits,
  parseAmount,
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

describe('parseAmount', () => {
  it('accepts a comma as the decimal separator', () => {
    // The bug this covers: "50,5" reached the server as NaN and failed with a
    // generic error, which is what an Italian or French donor types.
    expect(parseAmount('50,5')).toBe(50.5)
    expect(parseAmount('50.5')).toBe(50.5)
  })

  it('reads both grouping conventions', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('1 234,56')).toBe(1234.56)
  })

  it('treats a lone separator before three digits as grouping', () => {
    expect(parseAmount('1,500')).toBe(1500)
    expect(parseAmount('1.500')).toBe(1500)
    expect(parseAmount('1,234,567')).toBe(1234567)
  })

  it('keeps two-digit decimals intact', () => {
    expect(parseAmount('10,00')).toBe(10)
    expect(parseAmount('10.75')).toBe(10.75)
  })

  it('passes numbers through and rejects anything else', () => {
    expect(parseAmount(42)).toBe(42)
    expect(parseAmount('abc')).toBeNaN()
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount(null)).toBeNaN()
  })
})
