import { eq } from 'drizzle-orm'
import { unstable_cache, revalidateTag } from 'next/cache'
import { db } from '@/db'
import { navigationMenus, siteSettings, themes } from '@/db/schema'
import type { Locale } from '@/i18n/config'
import { defaultLocale, locales } from '@/i18n/config'
import {
  type BankTransferDetails,
  type ContactInfo,
  type DonationSettings,
  type FeatureToggles,
  type NavItem,
  type OrganisationDetails,
  type SeoSettings,
  type SocialLinks,
  donationSettingsSchema,
  featureTogglesSchema,
  organisationSchema,
  parseNavItems,
} from '@/lib/settings/schema'
import { defaultThemeTokens, parseThemeTokens, type ThemeTokens } from '@/lib/theme/tokens'
import type { I18nTextValue } from '@/i18n/schema'

export const SETTINGS_TAG = 'site-settings'
export const THEME_TAG = 'site-theme'
export const NAVIGATION_TAG = 'site-navigation'

export type SiteSettings = {
  siteName: string
  tagline: I18nTextValue
  description: I18nTextValue
  logoLightId: string | null
  logoDarkId: string | null
  faviconId: string | null
  ogImageId: string | null
  defaultLocale: Locale
  enabledLocales: Locale[]
  contact: ContactInfo
  social: SocialLinks
  seo: SeoSettings
  organisation: OrganisationDetails
  bankTransfer: BankTransferDetails
  donations: DonationSettings
  features: FeatureToggles
}

/** Used before the seed has run, or if the database is unreachable. */
const fallbackSettings: SiteSettings = {
  siteName: 'Patrick Wells',
  tagline: {},
  description: {},
  logoLightId: null,
  logoDarkId: null,
  faviconId: null,
  ogImageId: null,
  defaultLocale,
  enabledLocales: [...locales],
  contact: { addressLines: [], country: 'Uganda' },
  social: {},
  seo: { keywords: [] },
  organisation: { registryUrls: [] },
  bankTransfer: {},
  donations: donationSettingsSchema.parse({}),
  features: featureTogglesSchema.parse({}),
}

async function loadSettings(): Promise<SiteSettings> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1)
  if (!row) return fallbackSettings

  const enabled = Array.isArray(row.enabledLocales)
    ? row.enabledLocales.filter((locale): locale is Locale =>
        (locales as readonly string[]).includes(locale),
      )
    : [...locales]

  return {
    siteName: row.siteName,
    tagline: row.tagline ?? {},
    description: row.description ?? {},
    logoLightId: row.logoLightId,
    logoDarkId: row.logoDarkId,
    faviconId: row.faviconId,
    ogImageId: row.ogImageId,
    defaultLocale: row.defaultLocale as Locale,
    enabledLocales: enabled.length > 0 ? enabled : [...locales],
    contact: row.contact ?? fallbackSettings.contact,
    social: row.social ?? {},
    seo: row.seo ?? { keywords: [] },
    // Parsed rather than cast: rows written before a field existed have to
    // come back with its default rather than undefined.
    organisation: organisationSchema.parse(row.organisation ?? {}),
    bankTransfer: row.bankTransfer ?? {},
    donations: donationSettingsSchema.parse(row.donations ?? {}),
    features: featureTogglesSchema.parse(row.features ?? {}),
  }
}

/**
 * Settings, theme and navigation are read on nearly every request, so they are
 * cached and invalidated explicitly when the admin saves.
 */
export const getSiteSettings = unstable_cache(
  async () => {
    try {
      return await loadSettings()
    } catch (error) {
      console.error('[settings] falling back to defaults:', error)
      return fallbackSettings
    }
  },
  ['site-settings'],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
)

export const getActiveTheme = unstable_cache(
  async (): Promise<{ id: string | null; name: string; tokens: ThemeTokens }> => {
    try {
      const [row] = await db.select().from(themes).where(eq(themes.isActive, true)).limit(1)
      if (!row) return { id: null, name: 'Default', tokens: defaultThemeTokens }
      return { id: row.id, name: row.name, tokens: parseThemeTokens(row.tokens) }
    } catch (error) {
      console.error('[theme] falling back to defaults:', error)
      return { id: null, name: 'Default', tokens: defaultThemeTokens }
    }
  },
  ['site-theme'],
  { tags: [THEME_TAG], revalidate: 3600 },
)

export const getNavigation = unstable_cache(
  async (key: string): Promise<NavItem[]> => {
    try {
      const [row] = await db
        .select()
        .from(navigationMenus)
        .where(eq(navigationMenus.key, key))
        .limit(1)
      return parseNavItems(row?.items ?? [])
    } catch (error) {
      console.error(`[navigation:${key}] falling back to empty menu:`, error)
      return []
    }
  },
  ['site-navigation'],
  { tags: [NAVIGATION_TAG], revalidate: 3600 },
)

export function revalidateSettings() {
  revalidateTag(SETTINGS_TAG)
}

export function revalidateTheme() {
  revalidateTag(THEME_TAG)
}

export function revalidateNavigation() {
  revalidateTag(NAVIGATION_TAG)
}
