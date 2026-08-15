'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Link } from '@/i18n/navigation'
import { clusterMarkers } from '@/lib/transparency/cluster'
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

/**
 * `MapContainer` only reads its options once, at mount, so the gesture handlers
 * have to be toggled through the Leaflet instance rather than by re-rendering
 * with different props.
 */
function TouchGate({ active }: { active: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (active) {
      map.dragging.enable()
      map.touchZoom.enable()
    } else {
      map.dragging.disable()
      map.touchZoom.disable()
    }
  }, [active, map])

  return null
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
  const t = useTranslations('projects')
  /*
   * The map fills the column, so on a phone a one-finger swipe pans it instead
   * of scrolling the article and the reader gets stuck. Panning stays off until
   * the map is deliberately tapped — the touch counterpart of the
   * `scrollWheelZoom={false}` already applied to the desktop.
   *
   * `L.Browser.mobile` reads the user agent, which is only meaningful in the
   * browser — and that is the only place this runs, since the parent loads it
   * with `ssr: false`.
   */
  const [active, setActive] = useState(() => !L.Browser.mobile)

  return (
    <div className="relative">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={active}
        touchZoom={active}
        className="h-[22rem] w-full overflow-hidden rounded-[var(--radius-lg)] md:h-[28rem]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Markers markers={markers} initialZoom={zoom} />
        <TouchGate active={active} />
      </MapContainer>

      {active ? null : (
        <button
          type="button"
          onClick={() => setActive(true)}
          // `.leaflet-container` is given `z-index: 0` in globals.css, so it
          // opens a stacking context and this sibling only needs to clear it.
          className="absolute inset-0 z-10 grid place-items-center rounded-[var(--radius-lg)] bg-black/25 text-sm font-medium text-white"
        >
          <span className="rounded-full bg-black/70 px-4 py-2">{t('mapActivate')}</span>
        </button>
      )}
    </div>
  )
}
