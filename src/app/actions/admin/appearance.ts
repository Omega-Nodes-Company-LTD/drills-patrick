'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { navigationMenus, themes } from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { requireApiUser } from '@/lib/auth/guard'
import { navItemsSchema } from '@/lib/settings/schema'
import { revalidateNavigation, revalidateTheme } from '@/lib/settings/service'
import { defaultThemeTokens, themeTokensSchema } from '@/lib/theme/tokens'
import type { ActionResult } from '@/lib/validation/public'

/**
 * Appearance is stored in the database and read on every request, so saving
 * here changes the live site immediately after the cache tag is invalidated.
 */

export async function saveTheme(tokens: unknown): Promise<ActionResult> {
  const user = await requireApiUser('appearance')
  if (!user) return { ok: false, error: 'unauthorised' }

  const parsed = themeTokensSchema.safeParse(tokens)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      ),
    }
  }

  const [active] = await db.select().from(themes).where(eq(themes.isActive, true)).limit(1)

  if (active) {
    await db.update(themes).set({ tokens: parsed.data }).where(eq(themes.id, active.id))
  } else {
    await db.insert(themes).values({ name: 'Default', isActive: true, tokens: parsed.data })
  }

  await recordAudit({ actor: user, action: 'theme.update', entityType: 'theme' })

  revalidateTheme()
  return { ok: true }
}

export async function resetTheme(): Promise<ActionResult> {
  const user = await requireApiUser('appearance')
  if (!user) return { ok: false, error: 'unauthorised' }

  const [active] = await db.select().from(themes).where(eq(themes.isActive, true)).limit(1)

  if (active) {
    await db.update(themes).set({ tokens: defaultThemeTokens }).where(eq(themes.id, active.id))
  } else {
    await db.insert(themes).values({ name: 'Default', isActive: true, tokens: defaultThemeTokens })
  }

  await recordAudit({ actor: user, action: 'theme.reset', entityType: 'theme' })

  revalidateTheme()
  return { ok: true }
}

export async function saveNavigation(key: string, items: unknown): Promise<ActionResult> {
  const user = await requireApiUser('appearance')
  if (!user) return { ok: false, error: 'unauthorised' }

  if (!['header', 'footer', 'legal'].includes(key)) return { ok: false, error: 'invalid' }

  const parsed = navItemsSchema.safeParse(items)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const [existing] = await db
    .select()
    .from(navigationMenus)
    .where(eq(navigationMenus.key, key))
    .limit(1)

  if (existing) {
    await db.update(navigationMenus).set({ items: parsed.data }).where(eq(navigationMenus.id, existing.id))
  } else {
    await db.insert(navigationMenus).values({ key, label: key, items: parsed.data })
  }

  await recordAudit({
    actor: user,
    action: 'navigation.update',
    entityType: 'navigation',
    entityId: key,
  })

  revalidateNavigation()
  return { ok: true }
}
