import Link from 'next/link'

/**
 * Fallback for paths outside the locale segment, where no translations are
 * loaded. Everything the visitor normally reaches is served under `/[locale]`
 * and handled by the localised page next to the site layout.
 */
export default function RootNotFound() {
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
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.75rem' }}>Page not found</h1>
          <p style={{ color: '#5b6b78', margin: '0 0 1.5rem' }}>
            The page you are looking for has moved or never existed.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.4rem',
              borderRadius: '0.75rem',
              background: '#0a6d8f',
              color: '#ffffff',
              textDecoration: 'none',
            }}
          >
            Back to home
          </Link>
        </main>
      </body>
    </html>
  )
}
