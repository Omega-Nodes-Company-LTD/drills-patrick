import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/url'


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The partner area is for named organisations; there is nothing in
        // it to index, and its documents are not public.
        disallow: ['/admin', '/api/', '/portal', '/*/admin', '/*/portal', '/*/donate/status'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
