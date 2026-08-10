import { describe, expect, it } from 'vitest'
import { listingRobots } from '@/lib/seo'
import { NODE_ID, buildGraph, compact, ref } from '@/lib/seo/graph'
import {
  breadcrumbNode,
  faqPageNode,
  sectionBreadcrumb,
  waterPointNode,
} from '@/lib/seo/nodes'

describe('structured data graph', () => {
  it('drops empty values instead of emitting nulls', () => {
    expect(compact({ a: 1, b: undefined, c: null, d: '', e: [], f: [1] })).toEqual({ a: 1, f: [1] })
  })

  it('emits one graph with the nodes it was given', () => {
    const parsed = JSON.parse(
      buildGraph([{ '@type': 'WebPage', '@id': 'x#webpage' }, null, { '@type': 'Article' }]),
    )

    expect(parsed['@context']).toBe('https://schema.org')
    expect(parsed['@graph']).toHaveLength(2)
  })

  it('references nodes by id so they resolve inside the same graph', () => {
    const id = NODE_ID.organisation('en')
    expect(ref(id)).toEqual({ '@id': id })
    expect(id).toMatch(/#organisation$/)
  })

  it('gives each locale its own organisation id', () => {
    expect(NODE_ID.organisation('it')).toContain('/it/')
    expect(NODE_ID.organisation('en')).not.toContain('/it/')
  })
})

describe('breadcrumbs', () => {
  it('skips a breadcrumb with a single item', () => {
    // Home alone is not a trail; emitting it adds noise and no information.
    expect(
      sectionBreadcrumb({
        locale: 'en',
        homeName: 'Home',
        pageName: '',
        pageUrl: 'https://example.test/',
      }),
    ).not.toBeNull()

    expect(breadcrumbNode({ pageUrl: 'https://example.test/', items: [] })).toBeNull()
  })

  it('numbers the trail from the home page down', () => {
    const node = sectionBreadcrumb({
      locale: 'en',
      homeName: 'Home',
      section: { name: 'Projects', path: '/projects' },
      pageName: 'Kayunga borehole',
      pageUrl: 'https://example.test/projects/kayunga',
    })

    const items = node?.itemListElement as { position: number; name: string }[]
    expect(items.map((item) => item.position)).toEqual([1, 2, 3])
    expect(items.map((item) => item.name)).toEqual(['Home', 'Projects', 'Kayunga borehole'])
  })
})

describe('water point', () => {
  it('omits coordinates unless both are present', () => {
    // Half a pair would put the well on the equator or the prime meridian.
    const partial = waterPointNode({ url: 'u', name: 'Well', latitude: '0.34' })
    expect(partial.geo).toBeUndefined()

    const full = waterPointNode({ url: 'u', name: 'Well', latitude: '0.34', longitude: '32.58' })
    expect(full.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 0.34, longitude: 32.58 })
  })

  it('publishes measurements as values with units', () => {
    const node = waterPointNode({
      url: 'u',
      name: 'Well',
      depthMeters: 62,
      yieldLitersPerHour: 3000,
      beneficiaries: 850,
    })

    expect(node.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'depth', value: 62, unitCode: 'MTR' },
      { '@type': 'PropertyValue', name: 'yield', value: 3000, unitCode: 'E32' },
      { '@type': 'PropertyValue', name: 'peopleServed', value: 850 },
    ])
  })
})

describe('FAQ structured data', () => {
  it('skips entries without both a question and an answer', () => {
    const node = faqPageNode({
      url: 'u',
      items: [
        { question: 'How deep?', answerHtml: '<p>Around 60 m.</p>' },
        { question: 'Unanswered', answerHtml: '   ' },
        { question: '', answerHtml: '<p>Orphan answer.</p>' },
      ],
    })

    expect(node?.mainEntity).toHaveLength(1)
  })

  it('returns nothing when there is no answered question', () => {
    expect(faqPageNode({ url: 'u', items: [] })).toBeNull()
  })
})

describe('listing robots', () => {
  it('indexes the plain list', () => {
    expect(listingRobots({})).toEqual({ index: true, follow: true })
    expect(listingRobots({ status: undefined, page: '' })).toEqual({ index: true, follow: true })
  })

  it('keeps a filtered list crawlable but out of the index', () => {
    // Three filters crossed with pagination produce hundreds of near-copies;
    // `follow` still lets a crawler reach the entities behind them.
    expect(listingRobots({ status: 'completed' })).toEqual({ index: false, follow: true })
    expect(listingRobots({ page: '2' })).toEqual({ index: false, follow: true })
  })
})
