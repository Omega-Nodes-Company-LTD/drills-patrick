import type { ReactNode } from 'react'
import './globals.css'

/**
 * The real `<html>` element lives in `src/app/[locale]/layout.tsx` so that the
 * `lang` attribute can follow the active locale. This root layout only exists
 * because Next.js requires one.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
