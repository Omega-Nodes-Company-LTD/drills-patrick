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
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

export default withNextIntl(nextConfig)
