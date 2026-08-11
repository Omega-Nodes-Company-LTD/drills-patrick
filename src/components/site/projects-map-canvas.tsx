'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import { Link } from '@/i18n/navigation'
import type { ProjectMarker } from './projects-map'

const statusColors: Record<ProjectMarker['status'], string> = {
  planned: 'var(--c-muted-foreground)',
  in_progress: 'var(--c-warning)',
  completed: 'var(--c-success)',
}

/** Themed pin drawn with the palette variables, so it follows the site theme. */
function pinIcon(status: ProjectMarker['status']) {
  return L.divIcon({
    className: 'pw-map-pin',
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${statusColors[status]};border:3px solid var(--c-background);box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })
}

/** Cluster bubble; grows a little with the count so density reads at a glance. */
function clusterIcon(count: number) {
  const size = count > 50 ? 46 : count > 10 ? 40 : 34

  return L.divIcon({
    className: 'pw-map-cluster',
    html:
      `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;` +
      `background:var(--c-primary);color:var(--c-primary-foreground);border:3px solid var(--c-background);` +
      `font:600 13px/1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

type Cluster = {
  key: string
  lat: number
  lng: number
  markers: ProjectMarker[]
}

/**
 * Grid clustering, computed at the current zoom.
 *
 * A hundred boreholes in one district render as a hundred pins on top of each
 * other, which reads as one pin and hides the density that is the whole point
 * of the map. Grouping by a grid cell whose size halves with each zoom level
 * means zooming in splits clusters apart, which is the behaviour people expect.
 *
 * Done here rather than with a plugin: it is a dozen lines, it has no runtime
 * dependency to keep current, and the cell size is tuneable against how these
 * water points are actually distributed.
 */
function clusterMarkers(markers: ProjectMarker[], zoom: number): Cluster[] {
  // Degrees per cell: ~2° at the widest, halving with each zoom level, floored so the
  // grid stops merging anything once the reader is close in.
  const cell = Math.max(0.02, 8 / 2 ** zoom)
  const groups = new Map<string, Cluster>()

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

/**
 * Lives inside the map so it can read the live zoom and re-cluster on change.
 * `useMap` is the supported handle; reaching into the marker's internals is
 * not.
 */
function Markers({ markers, initialZoom }: { markers: ProjectMarker[]; initialZoom: number }) {
  const [zoom, setZoom] = useState(initialZoom)
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const clusters = useMemo(() => clusterMarkers(markers, zoom), [markers, zoom])

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.markers.length === 1) {
          const marker = cluster.markers[0]!

          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={pinIcon(marker.status)}
            >
              <Popup>
                <span className="block text-sm font-semibold">{marker.title}</span>
                {marker.district ? (
                  <span className="block text-xs opacity-70">{marker.district}</span>
                ) : null}
                <span className="mt-1 block text-xs">{marker.statusLabel}</span>
                <Link
                  href={`/projects/${marker.slug}`}
                  className="mt-1 inline-block text-xs font-medium underline"
                >
                  →
                </Link>
              </Popup>
            </Marker>
          )
        }

        return (
          <Marker
            key={cluster.key}
            position={[cluster.lat, cluster.lng]}
            icon={clusterIcon(cluster.markers.length)}
            eventHandlers={{
              // Clicking a cluster zooms toward it rather than opening a popup
              // listing forty water points nobody will read.
              click: () => map.setView([cluster.lat, cluster.lng], zoom + 2),
            }}
          />
        )
      })}
    </>
  )
}

export function MapCanvas({
  markers,
  center,
  zoom,
}: {
  markers: ProjectMarker[]
  center: { lat: number; lng: number }
  zoom: number
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-[22rem] w-full overflow-hidden rounded-[var(--radius-lg)] md:h-[28rem]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Markers markers={markers} initialZoom={zoom} />
    </MapContainer>
  )
}
