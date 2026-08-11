import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Links that stand in for a login.
 *
 * A volunteer running a fundraiser, a donor pausing a standing gift and a
 * recipient opening a gift card all need to reach one specific record and
 * nothing else. Making them register would lose most of them; letting them
 * pass an id in the URL would let anyone walk the table.
 *
 * The token is random, long, and stored only as a hash: a leaked database
 * backup hands over nothing usable. Comparison is constant-time so a caller
 * cannot learn a valid token one character at a time.
 */

/** 32 bytes of entropy — not guessable, and still fits in a link. */
export function issueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function tokenMatches(token: string, hash: string): boolean {
  if (!token || !hash) return false

  const candidate = Buffer.from(hashToken(token), 'utf8')
  const expected = Buffer.from(hash, 'utf8')

  // Lengths differ only when the stored hash is malformed, and timingSafeEqual
  // throws rather than returning false in that case.
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}
