import { env } from '@/env'

/**
 * Absolute URL builder.
 *
 * This lives apart from `lib/utils` on purpose: it reads the validated server
 * environment, and `lib/utils` is imported by client components — pulling the
 * env module into the browser bundle would make it throw at hydration time.
 */
export function absoluteUrl(path = '/'): string {
  return `${env.APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}
