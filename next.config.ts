import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Remote image hosts are derived from the S3 configuration so that a deployment
 * only has to set `S3_PUBLIC_BASE_URL` / `S3_ENDPOINT` to serve media.
 */
function remotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
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

const nextConfig: NextConfig = {
  // Required for the slim Docker image deployed on Coolify.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: remotePatterns(),
    formats: ['image/avif', 'image/webp'],
  },
  serverExternalPackages: ['sharp', 'postgres'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

export default withNextIntl(nextConfig)
