'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
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
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={pinIcon(marker.status)}>
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
      ))}
    </MapContainer>
  )
}
