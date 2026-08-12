/**
 * Initials for a person with no photograph.
 *
 * Pure, so it can be tested without a database and so the team block and any
 * future avatar fall back to the same two letters rather than disagreeing.
 *
 * Bracketed markers are dropped before anything else: placeholder rows are
 * named "[DEMO] Grace Nabukenya", and "[G" is not a set of initials.
 */
export function initialsOf(name: string): string {
  const letters = name
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part.match(/\p{L}/u)![0]!.toUpperCase())
    .join('')

  // A name with no letters at all — an organisation written in digits, say —
  // still needs something in the frame rather than an empty box.
  return letters || '·'
}
