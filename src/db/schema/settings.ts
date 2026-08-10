import { boolean, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import type { Locale } from '@/i18n/config'
import type { I18nTextValue } from '@/i18n/schema'
import type {
  BankTransferDetails,
  ContactInfo,
  DonationSettings,
  FeatureToggles,
  NavItem,
  OrganisationDetails,
  SeoSettings,
  SocialLinks,
} from '@/lib/settings/schema'
import type { ThemeTokens } from '@/lib/theme/tokens'
import { id, localeEnum, timestamps } from './shared'

/**
 * Single-row table holding everything that is not a page: identity, contacts,
 * SEO defaults, donation configuration and feature toggles.
 * The row is created by the seed and is always read with `getSiteSettings()`.
 */
export const siteSettings = pgTable('site_settings', {
  // Fixed at 1 so the table can never hold more than one configuration.
  id: integer().primaryKey().default(1),
  siteName: text().notNull().default('Patrick Wells'),
  tagline: jsonb().$type<I18nTextValue>().notNull().default({}),
  description: jsonb().$type<I18nTextValue>().notNull().default({}),

  logoLightId: uuid(),
  logoDarkId: uuid(),
  faviconId: uuid(),
  ogImageId: uuid(),

  defaultLocale: localeEnum().notNull().default('en'),
  enabledLocales: jsonb().$type<Locale[]>().notNull().default(['en', 'fr', 'it', 'de', 'lg']),

  contact: jsonb().$type<ContactInfo>().notNull().default({ addressLines: [], country: 'Uganda' }),
  social: jsonb().$type<SocialLinks>().notNull().default({}),
  seo: jsonb().$type<SeoSettings>().notNull().default({ keywords: [] }),
  organisation: jsonb().$type<OrganisationDetails>().notNull().default({}),
  bankTransfer: jsonb().$type<BankTransferDetails>().notNull().default({}),
  donations: jsonb().$type<DonationSettings>(),
  features: jsonb().$type<FeatureToggles>(),

  ...timestamps,
})

/**
 * Themes are versioned: an editor can keep several and activate one.
 * `tokens` is validated with `themeTokensSchema` before it is stored.
 */
export const themes = pgTable('themes', {
  id: id(),
  name: text().notNull(),
  isActive: boolean().notNull().default(false),
  tokens: jsonb().$type<ThemeTokens>().notNull(),
  ...timestamps,
})

/** `key` is one of `header`, `footer`, `legal`. */
export const navigationMenus = pgTable('navigation_menus', {
  id: id(),
  key: text().notNull().unique(),
  label: text().notNull(),
  items: jsonb().$type<NavItem[]>().notNull().default([]),
  ...timestamps,
})

export type SiteSettingsRow = typeof siteSettings.$inferSelect
export type ThemeRow = typeof themes.$inferSelect
export type NavigationMenuRow = typeof navigationMenus.$inferSelect
