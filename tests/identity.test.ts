import { describe, expect, it } from 'vitest'
import { formatAddress, formatLegalLine, identityOf } from '@/lib/settings/identity'
import type { SiteSettings } from '@/lib/settings/service'

const base = {
  siteName: 'Patrick Wells',
  contact: {
    addressLines: ['  Plot 14, Kira Road  ', ''],
    city: 'Kampala',
    country: 'Uganda',
    phone: ' +256 700 000 000 ',
    email: 'hello@example.test',
  },
  organisation: { legalName: 'Patrick Wells Ltd', registrationNumber: 'NGO/12345' },
} as unknown as SiteSettings

describe('organisation identity', () => {
  it('trims and drops empty address components', () => {
    expect(formatAddress(identityOf(base))).toBe('Plot 14, Kira Road, Kampala, Uganda')
  })

  it('omits a legal name identical to the public one', () => {
    const same = { ...base, siteName: 'Patrick Wells Ltd' } as SiteSettings
    expect(identityOf(same).legalName).toBeNull()
    expect(identityOf(base).legalName).toBe('Patrick Wells Ltd')
  })

  it('prints one legal line for the footer and the receipt', () => {
    expect(formatLegalLine(identityOf(base))).toBe('Patrick Wells Ltd — Reg. NGO/12345')
  })

  it('falls back to the public name when there is no legal one', () => {
    const plain = { ...base, organisation: {} } as SiteSettings
    expect(formatLegalLine(identityOf(plain))).toBe('Patrick Wells')
  })
})
