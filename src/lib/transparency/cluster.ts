/**
 * Grid clustering for the water point map.
 *
 * Kept out of the map component on purpose: the component cannot be imported
 * under the test runner because Leaflet touches `window` at import time, and
 * this is the part with behaviour worth pinning down.
 */

export type ClusterPoint = { lat: number; lng: number }

export type Cluster<T extends ClusterPoint> = {
  key: string
  lat: number
  lng: number
  markers: T[]
}

/**
 * Degrees per grid cell at a given zoom.
 *
 * Halves with each zoom level so zooming in splits clusters apart, and is
 * floored so that once the reader is close in the grid stops merging anything
 * and every water point gets its own pin.
 */
export function cellSize(zoom: number): number {
  return Math.max(0.02, 8 / 2 ** zoom)
}

/**
 * Groups markers that share a grid cell.
 *
 * A hundred boreholes in one district render as a hundred pins on top of each
 * other, which reads as one pin and hides the density that is the whole point
 * of the map.
 *
 * Done here rather than with a plugin: it is a dozen lines, it has no runtime
 * dependency to keep current, and the cell size is tuneable against how these
 * water points are actually distributed.
 */
export function clusterMarkers<T extends ClusterPoint>(markers: T[], zoom: number): Cluster<T>[] {
  const cell = cellSize(zoom)
  const groups = new Map<string, Cluster<T>>()

  for (const marker of markers) {
    const key = `${Math.floor(marker.lat / cell)}:${Math.floor(marker.lng / cell)}`
    const group = groups.get(key)

    if (group) group.markers.push(marker)
    else groups.set(key, { key, lat: marker.lat, lng: marker.lng, markers: [marker] })
  }

  // A cluster sits at the mean of its members, not at the first one, so the
  // bubble lands in the middle of the group rather than on its edge.
  return [...groups.values()].map((group) => ({
    ...group,
    lat: group.markers.reduce((total, marker) => total + marker.lat, 0) / group.markers.length,
    lng: group.markers.reduce((total, marker) => total + marker.lng, 0) / group.markers.length,
  }))
}
