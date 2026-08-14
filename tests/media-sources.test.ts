import { describe, expect, it } from 'vitest'
import { mediaSources, pickSource } from '@/lib/media/sources'

const toUrl = (key: string) => `https://bucket.example/${key}`

describe('mediaSources', () => {
  it('orders the derivatives smallest first', () => {
    const sources = mediaSources({ '1440': 'c.webp', '480': 'a.webp', '960': 'b.webp' }, toUrl)

    expect(sources.map((source) => source.width)).toEqual([480, 960, 1440])
    expect(sources[0]!.url).toBe('https://bucket.example/a.webp')
  })

  it('has nothing to offer for an image that was never processed', () => {
    expect(mediaSources({}, toUrl)).toEqual([])
    expect(mediaSources(null, toUrl)).toEqual([])
  })

  it('drops an entry the JSON column should not have held', () => {
    const sources = mediaSources({ '960': 'b.webp', wide: 'x.webp', '0': 'y.webp' }, toUrl)

    expect(sources.map((source) => source.width)).toEqual([960])
  })

  it('drops an entry with no resolvable URL, rather than linking to nothing', () => {
    expect(mediaSources({ '960': 'b.webp' }, () => '')).toEqual([])
  })
})

describe('pickSource', () => {
  const sources = mediaSources({ '480': 'a.webp', '960': 'b.webp', '1920': 'c.webp' }, toUrl)
  const original = 'https://bucket.example/original.jpg'

  it('takes the smallest derivative that still covers the request', () => {
    expect(pickSource(sources, original, 320)).toBe('https://bucket.example/a.webp')
    expect(pickSource(sources, original, 480)).toBe('https://bucket.example/a.webp')
    expect(pickSource(sources, original, 481)).toBe('https://bucket.example/b.webp')
  })

  it('stops at the largest derivative rather than falling back to the original', () => {
    // A 4K screen asking for 3840 would otherwise be handed the untouched
    // upload, which is the download this whole path exists to avoid.
    expect(pickSource(sources, original, 3840)).toBe('https://bucket.example/c.webp')
  })

  it('serves the original when there is no derivative at all', () => {
    expect(pickSource([], original, 1920)).toBe(original)
  })
})
