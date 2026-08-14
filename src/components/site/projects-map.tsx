'use client'

import dynamic from 'next/dynamic'

export type ProjectMarker = {
  id: string
  slug: string
  title: string
  status: 'planned' | 'in_progress' | 'completed'
  statusLabel: string
  lat: number
  lng: number
  district: string | null
}

/** A pin the editor placed by hand, with no project behind it. */
export type MapPlace = {
  id: string
  label: string
  note: string | null
  lat: number
  lng: number
}

/**
 * Leaflet touches `window` at import time, so the actual map is loaded only in
 * the browser. This wrapper keeps the server tree free of it.
 */
const MapCanvas = dynamic(() => import('./projects-map-canvas').then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="h-[22rem] w-full animate-pulse rounded-[var(--radius-lg)] bg-muted md:h-[28rem]" />
  ),
})

export function ProjectsMap({
  markers,
  places = [],
  center,
  zoom,
  viewLabel,
}: {
  markers: ProjectMarker[]
  places?: MapPlace[]
  center: { lat: number; lng: number }
  zoom: number
  viewLabel: string
}) {
  return (
    <MapCanvas
      markers={markers}
      places={places}
      center={center}
      zoom={zoom}
      viewLabel={viewLabel}
    />
  )
}
