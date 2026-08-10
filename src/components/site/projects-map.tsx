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
  center,
  zoom,
}: {
  markers: ProjectMarker[]
  center: { lat: number; lng: number }
  zoom: number
}) {
  return <MapCanvas markers={markers} center={center} zoom={zoom} />
}
