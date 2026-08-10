'use client'

import { useEffect } from 'react'

/**
 * Last resort: the root layout itself failed, so no provider, theme or
 * translation is available. It must render its own `<html>`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global] render failed:', error.digest ?? error.message)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          margin: 0,
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#ffffff',
          color: '#0f1c26',
        }}
      >
        <main style={{ textAlign: 'center', maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.75rem' }}>Something went wrong</h1>
          <p style={{ color: '#5b6b78', margin: '0 0 1.5rem' }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest ? (
            <p style={{ color: '#5b6b78', fontSize: '0.85rem' }}>
              <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.7rem 1.4rem',
              borderRadius: '0.75rem',
              border: 0,
              background: '#0a6d8f',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
