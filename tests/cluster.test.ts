import { describe, expect, it } from 'vitest'
import { cellSize, clusterMarkers } from '@/lib/transparency/cluster'

const point = (lat: number, lng: number) => ({ lat, lng, id: `${lat},${lng}` })

describe('cellSize', () => {
  it('halves with each zoom level', () => {
    expect(cellSize(3)).toBeCloseTo(cellSize(2) / 2)
    expect(cellSize(8)).toBeCloseTo(cellSize(7) / 2)
  })

  it('keeps halving across every zoom a tile layer can reach', () => {
    for (let zoom = 2; zoom < 19; zoom += 1) {
      expect(cellSize(zoom + 1)).toBeCloseTo(cellSize(zoom) / 2, 12)
    }
  })

  it('is small enough at full zoom to separate two water points in one village', () => {
    // A hundred metres is about 0.0009°, and two boreholes that far apart are
    // ordinary. The cell has to be under that well before the map runs out of
    // zoom, or they can never be told apart.
    expect(cellSize(16)).toBeLessThan(0.0009)
  })

  it('stops shrinking once the cell is meaningless', () => {
    expect(cellSize(30)).toBe(2e-6)
  })
})

describe('clusterMarkers', () => {
  it('returns nothing for no markers', () => {
    expect(clusterMarkers([], 6)).toEqual([])
  })

  it('groups water points that share a cell', () => {
    // Three boreholes a few hundred metres apart, seen from a country-wide zoom.
    const clusters = clusterMarkers([point(0.34, 32.58), point(0.35, 32.59), point(0.36, 32.6)], 5)

    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.markers).toHaveLength(3)
  })

  it('keeps distant water points apart', () => {
    const clusters = clusterMarkers([point(0.34, 32.58), point(2.77, 32.29)], 5)

    expect(clusters).toHaveLength(2)
    expect(clusters.every((cluster) => cluster.markers.length === 1)).toBe(true)
  })

  it('splits a cluster as the reader zooms in', () => {
    const markers = [point(0.34, 32.58), point(0.42, 32.66)]

    expect(clusterMarkers(markers, 5)).toHaveLength(1)
    expect(clusterMarkers(markers, 12)).toHaveLength(2)
  })

  it('separates boreholes in the same village once the reader is close in', () => {
    // The three from the grouping test above, about a kilometre apart. They
    // used to stay merged at every zoom, so their popups could not be opened
    // at all.
    const markers = [point(0.34, 32.58), point(0.35, 32.59), point(0.36, 32.6)]

    expect(clusterMarkers(markers, 5)).toHaveLength(1)
    expect(clusterMarkers(markers, 14)).toHaveLength(3)
  })

  it('separates two water points a hundred metres apart', () => {
    const markers = [point(0.34, 32.58), point(0.3409, 32.5809)]

    expect(clusterMarkers(markers, 17)).toHaveLength(2)
  })

  it('places a cluster at the mean of its members, not the first one', () => {
    // Zoom 4 means half-degree cells: both points sit inside 0–0.5 / 32.5–33.
    const clusters = clusterMarkers([point(0.1, 32.5), point(0.3, 32.7)], 4)

    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.lat).toBeCloseTo(0.2)
    expect(clusters[0]!.lng).toBeCloseTo(32.6)
  })

  it('never loses a water point', () => {
    const markers = Array.from({ length: 120 }, (_, index) =>
      point(-1 + (index % 12) * 0.4, 30 + Math.floor(index / 12) * 0.4),
    )

    for (const zoom of [3, 5, 8, 11, 16]) {
      const total = clusterMarkers(markers, zoom).reduce(
        (count, cluster) => count + cluster.markers.length,
        0,
      )
      expect(total).toBe(markers.length)
    }
  })

  it('handles the southern and western hemispheres', () => {
    const clusters = clusterMarkers([point(-1.94, 30.06), point(-1.95, 30.07)], 6)

    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.lat).toBeLessThan(0)
  })
})
