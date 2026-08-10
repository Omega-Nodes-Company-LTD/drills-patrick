import bcrypt from 'bcryptjs'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

/** Minimum policy enforced on both the login form and the admin user editor. */
export function passwordIssues(password: string): string[] {
  const issues: string[] = []
  if (password.length < 10) issues.push('at least 10 characters')
  if (!/[a-z]/.test(password)) issues.push('a lowercase letter')
  if (!/[A-Z]/.test(password)) issues.push('an uppercase letter')
  if (!/[0-9]/.test(password)) issues.push('a digit')
  return issues
}
