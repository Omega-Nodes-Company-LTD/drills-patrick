import { describe, expect, it } from 'vitest'
import { median } from '@/lib/ngo/faults'

describe('median', () => {
  it('is null with nothing to measure', () => {
    expect(median([])).toBeNull()
  })

  it('takes the middle of an odd sample', () => {
    expect(median([9, 1, 5])).toBe(5)
  })

  it('averages the two middles of an even sample', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('is not dragged by one water point cut off for weeks', () => {
    // Four faults fixed within a day, one stranded by the rains for three weeks.
    const hours = [4, 6, 8, 10, 504]
    const mean = hours.reduce((total, value) => total + value, 0) / hours.length

    expect(median(hours)).toBe(8)
    expect(mean).toBeGreaterThan(100)
  })

  it('does not reorder the caller’s array', () => {
    const hours = [9, 1, 5]
    median(hours)
    expect(hours).toEqual([9, 1, 5])
  })
})
