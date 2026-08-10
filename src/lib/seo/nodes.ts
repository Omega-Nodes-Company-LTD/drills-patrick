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
 * The site as a whole, with the search endpoint it exposes.
 *
 * `SearchAction` is what a search engine reads to offer a search box inside
 * its own results for this site, and what an answer engine reads to know the
 * site can be queried rather than only crawled. The template points at the
 * real `/search?q=` route, per language.
 */
export function webSiteNode(settings: SiteSettings, locale: Locale): GraphNode {
  const searchUrl = localeUrl(locale, '/search')

  return {
    '@type': 'WebSite',
    '@id': NODE_ID.website(locale),
    url: localeUrl(locale, '/'),
    name: settings.siteName,
    inLanguage: locale,
    publisher: ref(NODE_ID.organisation(locale)),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${searchUrl}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Where the page sits in the site.
 *
 * Detail pages are reached from a list, but a URL alone does not say so.
 * The breadcrumb is what turns "/projects/kayunga-borehole" into "Home ›
 * Projects › Kayunga borehole" in a result, and what tells an answer engine
 * which section an answer came from.
 */
export function breadcrumbNode(params: {
  pageUrl: string
  items: { name: string; url: string }[]
}): GraphNode | null {
  if (params.items.length < 2) return null

  return {
    '@type': 'BreadcrumbList',
    '@id': NODE_ID.breadcrumb(params.pageUrl),
    itemListElement: params.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * A water point as a place on the ground.
 *
 * This is the site's core entity and the one an answer engine is most often
 * asked about — "is there a borehole near X", "how deep", "how many people
 * does it serve". A `Place` with coordinates and an address answers the
 * first; the measurements go in as `PropertyValue`s with units, which is what
 * makes a number extractable rather than a string in a paragraph.
 *
 * Coordinates are only emitted when both are present: a half-set pair would
 * put the well at the equator.
 */
export function waterPointNode(params: {
  url: string
  name: string
  description?: string | null
  typeLabel?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
  country?: string | null
  region?: string | null
  district?: string | null
  village?: string | null
  depthMeters?: number | null
  yieldLitersPerHour?: number | null
  beneficiaries?: number | null
  image?: string | null
}): GraphNode {
  const lat = params.latitude != null ? Number(params.latitude) : null
  const lng = params.longitude != null ? Number(params.longitude) : null
  const hasGeo = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)

  const measurements = [
    params.depthMeters != null && {
      '@type': 'PropertyValue',
      name: 'depth',
      value: params.depthMeters,
      unitCode: 'MTR',
    },
    params.yieldLitersPerHour != null && {
      '@type': 'PropertyValue',
      name: 'yield',
      value: params.yieldLitersPerHour,
      unitCode: 'E32',
    },
    params.beneficiaries
      ? { '@type': 'PropertyValue', name: 'peopleServed', value: params.beneficiaries }
      : null,
  ].filter(Boolean)

  const address = {
    '@type': 'PostalAddress',
    streetAddress: params.village || undefined,
    addressLocality: params.district || undefined,
    addressRegion: params.region || undefined,
    addressCountry: params.country || undefined,
  }

  return {
    '@type': 'Place',
    '@id': `${params.url}#waterpoint`,
    name: params.name,
    description: params.description ?? undefined,
    additionalType: params.typeLabel || undefined,
    image: params.image || undefined,
    address:
      address.streetAddress || address.addressLocality || address.addressRegion
        ? address
        : undefined,
    ...(hasGeo ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}),
    additionalProperty: measurements.length > 0 ? measurements : undefined,
  }
}

/**
 * The FAQ page as questions and answers.
 *
 * An accordion is a list of `<button>`s to a crawler. `FAQPage` states which
 * text is a question and which is its answer, which is the difference between
 * a page that can be quoted and one that can only be linked.
 */
export function faqPageNode(params: {
  url: string
  items: { question: string; answerHtml: string }[]
}): GraphNode | null {
  const answered = params.items.filter((item) => item.question.trim() && item.answerHtml.trim())
  if (answered.length === 0) return null

  return {
    '@type': 'FAQPage',
    '@id': `${params.url}#faq`,
    mainEntity: answered.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answerHtml },
    })),
  }
}

/**
 * Marks the parts of a page a voice assistant should read aloud.
 *
 * CSS selectors rather than text, so the marked region follows the markup
 * instead of being duplicated into the structured data and drifting from it.
 */
export const SPEAKABLE = {
  '@type': 'SpeakableSpecification',
  cssSelector: ['h1', '[data-speakable]'],
} as const

/** Home › section › page, the shape every detail route needs. */
export function sectionBreadcrumb(params: {
  locale: Locale
  homeName: string
  section?: { name: string; path: string }
  pageName: string
  pageUrl: string
}): GraphNode | null {
  const items = [{ name: params.homeName, url: localeUrl(params.locale, '/') }]

  if (params.section) {
    items.push({
      name: params.section.name,
      url: localeUrl(params.locale, params.section.path),
    })
  }

  items.push({ name: params.pageName, url: params.pageUrl })

  return breadcrumbNode({ pageUrl: params.pageUrl, items })
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
  /** Pages whose heading and summary are worth reading aloud. */
  speakable?: boolean
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
    speakable: params.speakable ? SPEAKABLE : undefined,
  }
}
