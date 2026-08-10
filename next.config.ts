import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Remote image hosts are derived from the S3 configuration so that a deployment
 * only has to set `S3_PUBLIC_BASE_URL` / `S3_ENDPOINT` to serve media.
 *
 * Next.js bakes this list into the build, so the variables have to be present
 * *at build time* — on Coolify that means marking them as build variables, not
 * only as runtime environment. When they are missing the optimiser is turned
 * off instead (see below), so media still renders rather than 400-ing.
 */
type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number]

function remotePatterns(): RemotePattern[] {
  const hosts = [process.env.S3_PUBLIC_BASE_URL, process.env.S3_ENDPOINT].filter(
    (value): value is string => Boolean(value),
  )

  return hosts.flatMap((value) => {
    try {
      const url = new URL(value)
      return [
        {
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
          hostname: url.hostname,
        },
        // Hetzner Object Storage also serves buckets as virtual-hosted subdomains.
        {
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
          hostname: `*.${url.hostname}`,
        },
      ]
    } catch {
      return []
    }
  })
}

const imagePatterns = remotePatterns()

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` stays on scripts because Next.js inlines its own bootstrap
 * and flight payloads, and the theme is injected as an inline `<style>` built
 * from the database — a nonce would have to be threaded through every static
 * response to remove it. Everything else is closed: no external script origin
 * is allowed at all, since the payment providers are reached by redirect
 * rather than by an embedded SDK.
 *
 * `frame-src` matches the embed hosts the sanitiser accepts in rich text.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com',
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Coolify terminates TLS in front of the app; the header is only honoured
  // over HTTPS, so it is harmless on a plain-HTTP local run.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), interest-cohort=()',
  },
]

const nextConfig: NextConfig = {
  // Required for the slim Docker image deployed on Coolify.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: imagePatterns,
    formats: ['image/avif', 'image/webp'],
    // Without an allowed host the optimiser rejects every bucket URL, which
    // would break media across the whole site at runtime with no clear cause.
    // Serving the originals unoptimised is the better failure mode.
    unoptimized: imagePatterns.length === 0,
  },
  serverExternalPackages: ['sharp', 'postgres'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Answers are per-request and often personal; none of them belong in an
      // index or an intermediate cache.
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

export default withNextIntl(nextConfig)
