import { describe, expect, it } from 'vitest'
import { NODE_ID, buildGraph, compact, ref } from '@/lib/seo/graph'
import { breadcrumbNode, sectionBreadcrumb } from '@/lib/seo/nodes'

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
