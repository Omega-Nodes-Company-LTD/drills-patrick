import type { Locale } from '@/i18n/config'
import type { SiteSettings } from '@/lib/settings/service'
import { NODE_ID, ref, type GraphNode } from './graph'
import { localeUrl } from './index'

/**
 * The nodes every page shares. Pages add their own on top and pass the whole
 * list to `<JsonLd>`, which emits one `@graph`.
 */

/**
 * Who runs the site.
 *
 * `NGO` rather than a plain `Organization`: it is the type a search engine
 * and an answer engine both read as "not a business", which is the single
 * most load-bearing fact about this site. Everything in it comes from the
 * settings the operator filled in — nothing is inferred, and an unfilled
 * field is left out rather than guessed.
 */
export function organisationNode(settings: SiteSettings, locale: Locale): GraphNode {
  const { contact, organisation, social } = settings

  // Every profile the operator entered, in one list: this is what ties the
  // site to bodies that already vouch for the organisation.
  const sameAs = [
    social.facebook,
    social.instagram,
    social.linkedin,
    social.x,
    social.youtube,
    ...(organisation.registryUrls ?? []),
  ].filter((value): value is string => Boolean(value?.trim()))

  const address = {
    '@type': 'PostalAddress',
    streetAddress: contact.addressLines.filter(Boolean).join(', ') || undefined,
    addressLocality: contact.city || undefined,
    addressCountry: contact.country || undefined,
  }

  return {
    '@type': ['NGO', 'Organization'],
    '@id': NODE_ID.organisation(locale),
    name: settings.siteName,
    legalName: organisation.legalName || undefined,
    url: localeUrl(locale, '/'),
    email: contact.email || undefined,
    telephone: contact.phone || undefined,
    address: address.streetAddress || address.addressLocality ? address : undefined,
    foundingDate: organisation.foundedYear ? String(organisation.foundedYear) : undefined,
    taxID: organisation.vatNumber || undefined,
    identifier: organisation.registrationNumber || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    ...(contact.mapLat != null && contact.mapLng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: contact.mapLat, longitude: contact.mapLng } }
      : {}),
  }
}

/**
 * The page itself. Everything specific — an article, a project, a campaign —
 * declares this node as its `mainEntityOfPage`, which is what ties a piece of
 * content to the URL it is published at.
 */
export function webPageNode(params: {
  locale: Locale
  url: string
  name: string
  description?: string | null
  dateModified?: Date | string | null
}): GraphNode {
  const modified =
    params.dateModified instanceof Date
      ? params.dateModified.toISOString()
      : (params.dateModified ?? undefined)

  return {
    '@type': 'WebPage',
    '@id': NODE_ID.page(params.url),
    url: params.url,
    name: params.name,
    description: params.description ?? undefined,
    inLanguage: params.locale,
    dateModified: modified,
    isPartOf: ref(NODE_ID.website(params.locale)),
  }
}
