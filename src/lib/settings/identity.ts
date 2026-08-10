import type { SiteSettings } from './service'

/**
 * The organisation's name, address and phone, formatted once.
 *
 * These three facts — NAP, in the local-search vocabulary — are how a search
 * or answer engine decides that a website, a directory entry and a receipt
 * describe the same body. If the footer says "Kampala, Uganda", the structured
 * data says "Kampala" and the receipt says nothing at all, each is weaker
 * evidence than one consistent answer would be.
 *
 * Every surface that shows the organisation reads from here.
 */

export type Identity = {
  /** Public-facing name, the one visitors recognise. */
  name: string
  /** Registered name, when it differs from the public one. */
  legalName: string | null
  /** Registration number, printed on receipts and published as an identifier. */
  registrationNumber: string | null
  /** Address components in postal order, already filtered. */
  addressLines: string[]
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
}

export function identityOf(settings: SiteSettings): Identity {
  const { contact, organisation } = settings
  const legalName = organisation.legalName?.trim() || null

  return {
    name: settings.siteName,
    legalName: legalName && legalName !== settings.siteName ? legalName : null,
    registrationNumber: organisation.registrationNumber?.trim() || null,
    addressLines: contact.addressLines.map((line) => line.trim()).filter(Boolean),
    city: contact.city?.trim() || null,
    country: contact.country?.trim() || null,
    phone: contact.phone?.trim() || null,
    email: contact.email?.trim() || null,
  }
}

/** One-line address, in the order a postal address is written. */
export function formatAddress(identity: Identity): string {
  return [...identity.addressLines, identity.city, identity.country].filter(Boolean).join(', ')
}

/** Name and registration, the line a receipt and a footer both carry. */
export function formatLegalLine(identity: Identity): string {
  const name = identity.legalName ?? identity.name
  return identity.registrationNumber ? `${name} — Reg. ${identity.registrationNumber}` : name
}
