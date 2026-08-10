import { headers } from 'next/headers'

/**
 * Small in-process rate limiter for public forms and the chat endpoint.
 *
 * It is intentionally simple: a fixed window per key held in memory. That is
 * enough for a single-container Coolify deployment. If the app is ever scaled
 * horizontally this should move to Redis or the database.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function sweep(now: number) {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  bucket.count += 1

  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 }
}

/** Best-effort client address, honouring the proxy headers Coolify sets. */
export async function clientIdentifier(): Promise<string> {
  const store = await headers()
  const forwarded = store.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return store.get('x-real-ip') ?? 'unknown'
}
