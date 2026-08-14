'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import { Link } from '@/i18n/navigation'
import { clusterMarkers } from '@/lib/transparency/cluster'
import type { MapPlace, ProjectMarker } from './projects-map'

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

/**
 * Pin for a place the editor added by hand — an office, a district covered, a
 * site not yet opened as a project. Deliberately a different shape as well as
 * a different colour, so it does not read as a water point in a screenshot or
 * to someone who cannot tell the two colours apart.
 */
function placeIcon() {
  return L.divIcon({
    className: 'pw-map-place',
    html:
      `<span style="display:block;width:16px;height:16px;border-radius:3px;background:var(--c-primary);` +
      `border:3px solid var(--c-background);box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(45deg)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

/**
 * Lives inside the map so it can read the live zoom and re-cluster on change.
 * `useMap` is the supported handle; reaching into the marker's internals is
 * not.
 */
function Markers({
  markers,
  initialZoom,
  viewLabel,
}: {
  markers: ProjectMarker[]
  initialZoom: number
  viewLabel: string
}) {
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
                  {viewLabel}
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
              // Clicking a cluster frames its members rather than opening a
              // popup listing forty water points nobody will read. Fitting the
              // bounds rather than guessing at `zoom + 2` means one click
              // always arrives at the level where the group actually comes
              // apart, however tightly it is packed.
              click: () =>
                map.fitBounds(
                  L.latLngBounds(cluster.markers.map((marker) => [marker.lat, marker.lng])),
                  { padding: [48, 48] },
                ),
            }}
          />
        )
      })}
    </>
  )
}

export function MapCanvas({
  markers,
  places,
  center,
  zoom,
  viewLabel,
}: {
  markers: ProjectMarker[]
  places: MapPlace[]
  center: { lat: number; lng: number }
  zoom: number
  viewLabel: string
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

      {/* Hand-placed pins are never clustered: they were positioned one by one
          and there are few enough that hiding them behind a bubble would only
          take away what the editor put there. */}
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lng]} icon={placeIcon()}>
          <Popup>
            <span className="block text-sm font-semibold">{place.label}</span>
            {place.note ? <span className="mt-1 block text-xs">{place.note}</span> : null}
          </Popup>
        </Marker>
      ))}

      <Markers markers={markers} initialZoom={zoom} viewLabel={viewLabel} />
    </MapContainer>
  )
}
