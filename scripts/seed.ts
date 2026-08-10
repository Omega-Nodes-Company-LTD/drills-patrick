/* eslint-disable no-console */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import * as schema from '../src/db/schema'
import { defaultThemeTokens } from '../src/lib/theme/tokens'
import type { Locale } from '../src/i18n/config'

/**
 * Bootstraps an empty installation.
 *
 * This deliberately creates **no editorial content**: no projects, articles,
 * campaigns or images. It only puts in place what the application needs to
 * boot and be usable — an administrator account, the default theme, the
 * settings row, the three menus and the empty system pages. Everything else is
 * added from the admin area.
 *
 * Run with `pnpm db:seed`. Pass `--reset` to wipe everything first.
 */

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

const client = postgres(url, { max: 1 })
const db = drizzle(client, { schema, casing: 'snake_case' })

const LOCALES: Locale[] = ['en', 'fr', 'it', 'de', 'lg']
type L = Record<Locale, string>

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe2026!'
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrator'
const SITE_NAME = process.env.SEED_SITE_NAME ?? 'Wells Company'

async function reset() {
  console.log('Resetting database…')
  await db.execute(sql`
    TRUNCATE TABLE
      content_embeddings, chat_messages, chat_conversations,
      donation_events, donations, campaign_translations, campaigns,
      project_update_translations, project_updates, project_translations, projects,
      post_tags, post_translations, posts, tag_translations, tags,
      category_translations, categories, page_translations, pages,
      testimonial_translations, testimonials, team_member_translations, team_members,
      partner_translations, partners, faq_translations, faqs,
      ngo_inquiries, contact_submissions, newsletter_subscribers,
      navigation_menus, themes, site_settings, media, audit_log,
      password_reset_tokens, users
    RESTART IDENTITY CASCADE
  `)
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const [admin] = await db
    .insert(schema.users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash,
      name: ADMIN_NAME,
      role: 'admin',
      locale: 'en',
    })
    .onConflictDoNothing()
    .returning()

  if (admin) {
    console.log(`  administrator: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
    console.log('  change this password right after the first sign-in.')
  } else {
    console.log(`  administrator ${ADMIN_EMAIL} already exists — left untouched.`)
  }
}

async function seedTheme() {
  await db
    .insert(schema.themes)
    .values({ name: 'Default', isActive: true, tokens: defaultThemeTokens })
    .onConflictDoNothing()
}

/**
 * Settings row with neutral values. Names, contacts, bank details and social
 * links are intentionally blank — the operator fills them in under Settings.
 */
async function seedSettings() {
  await db
    .insert(schema.siteSettings)
    .values({
      id: 1,
      siteName: SITE_NAME,
      tagline: {},
      description: {},
      defaultLocale: 'en',
      enabledLocales: LOCALES,
      contact: { addressLines: [], country: 'Uganda' },
      social: {},
      seo: { keywords: [] },
      organisation: {},
      bankTransfer: {},
      donations: {
        defaultCurrency: 'EUR',
        currencies: ['EUR', 'USD', 'UGX'],
        suggestedAmounts: {
          EUR: [25, 50, 150, 500],
          USD: [25, 50, 150, 500],
          UGX: [50000, 150000, 500000, 1500000],
        },
        minAmount: { EUR: 5, USD: 5, UGX: 10000 },
        allowRecurring: false,
        receiptPrefix: 'WC',
      },
      features: {
        blog: true,
        projects: true,
        donations: true,
        newsletter: true,
        chatAssistant: true,
        semanticSearch: true,
      },
    })
    .onConflictDoNothing()
}

/**
 * Menus point at the built-in routes so the site is navigable from the first
 * boot. Labels are editable and links can be removed under Appearance →
 * Navigation.
 */
async function seedNavigation() {
  const item = (id: string, href: string, label: L, highlight = false) => ({
    id,
    href,
    label,
    external: false,
    highlight,
    children: [],
  })

  await db
    .insert(schema.navigationMenus)
    .values([
      {
        key: 'header',
        label: 'Header',
        items: [
          item('nav-projects', '/projects', {
            en: 'Projects',
            fr: 'Projets',
            it: 'Progetti',
            de: 'Projekte',
            lg: 'Pulojekiti',
          }),
          item('nav-campaigns', '/campaigns', {
            en: 'Fundraising',
            fr: 'Collecte de fonds',
            it: 'Raccolta fondi',
            de: 'Spendenaktionen',
            lg: 'Kaweefube',
          }),
          item('nav-blog', '/blog', {
            en: 'News',
            fr: 'Actualités',
            it: 'Notizie',
            de: 'Aktuelles',
            lg: 'Amawulire',
          }),
          item('nav-about', '/about', {
            en: 'About us',
            fr: 'À propos',
            it: 'Chi siamo',
            de: 'Über uns',
            lg: 'Ebitukwatako',
          }),
          item('nav-contact', '/contact', {
            en: 'Contact',
            fr: 'Contact',
            it: 'Contatti',
            de: 'Kontakt',
            lg: 'Tutuukirire',
          }),
          item(
            'nav-donate',
            '/donate',
            { en: 'Donate', fr: 'Faire un don', it: 'Dona', de: 'Spenden', lg: 'Waayo' },
            true,
          ),
        ],
      },
      {
        key: 'footer',
        label: 'Footer',
        items: [
          item('foot-projects', '/projects', {
            en: 'Projects',
            fr: 'Projets',
            it: 'Progetti',
            de: 'Projekte',
            lg: 'Pulojekiti',
          }),
          item('foot-campaigns', '/campaigns', {
            en: 'Fundraising',
            fr: 'Collecte de fonds',
            it: 'Raccolta fondi',
            de: 'Spendenaktionen',
            lg: 'Kaweefube',
          }),
          item('foot-about', '/about', {
            en: 'About us',
            fr: 'À propos',
            it: 'Chi siamo',
            de: 'Über uns',
            lg: 'Ebitukwatako',
          }),
          item('foot-contact', '/contact', {
            en: 'Contact',
            fr: 'Contact',
            it: 'Contatti',
            de: 'Kontakt',
            lg: 'Tutuukirire',
          }),
        ],
      },
      {
        key: 'legal',
        label: 'Legal',
        items: [
          item('legal-privacy', '/privacy', {
            en: 'Privacy',
            fr: 'Confidentialité',
            it: 'Privacy',
            de: 'Datenschutz',
            lg: 'Ebyama',
          }),
          item('legal-terms', '/terms', {
            en: 'Terms',
            fr: 'Conditions',
            it: 'Termini',
            de: 'Bedingungen',
            lg: 'Ebiragiro',
          }),
        ],
      },
    ])
    .onConflictDoNothing()
}

/**
 * Empty system pages: they exist so the routes resolve and the editor has
 * something to open, but they carry no sections until someone adds them.
 */
async function seedPages() {
  const pages: { key: string; isSystem: boolean; title: L; slugs: L }[] = [
    {
      key: 'home',
      isSystem: true,
      title: { en: 'Home', fr: 'Accueil', it: 'Home', de: 'Startseite', lg: 'Awaka' },
      slugs: { en: 'home', fr: 'accueil', it: 'home', de: 'startseite', lg: 'awaka' },
    },
    {
      key: 'about',
      isSystem: true,
      title: {
        en: 'About us',
        fr: 'À propos',
        it: 'Chi siamo',
        de: 'Über uns',
        lg: 'Ebitukwatako',
      },
      slugs: { en: 'about', fr: 'a-propos', it: 'chi-siamo', de: 'ueber-uns', lg: 'ebitukwatako' },
    },
    {
      key: 'contact',
      isSystem: true,
      title: { en: 'Contact', fr: 'Contact', it: 'Contatti', de: 'Kontakt', lg: 'Tutuukirire' },
      slugs: { en: 'contact', fr: 'contact', it: 'contatti', de: 'kontakt', lg: 'tutuukirire' },
    },
    {
      key: 'privacy',
      isSystem: false,
      title: {
        en: 'Privacy',
        fr: 'Confidentialité',
        it: 'Privacy',
        de: 'Datenschutz',
        lg: 'Ebyama',
      },
      slugs: {
        en: 'privacy',
        fr: 'confidentialite',
        it: 'privacy',
        de: 'datenschutz',
        lg: 'ebyama',
      },
    },
    {
      key: 'terms',
      isSystem: false,
      title: {
        en: 'Terms',
        fr: 'Conditions',
        it: 'Termini',
        de: 'Bedingungen',
        lg: 'Ebiragiro',
      },
      slugs: { en: 'terms', fr: 'conditions', it: 'termini', de: 'bedingungen', lg: 'ebiragiro' },
    },
  ]

  for (const page of pages) {
    const [row] = await db
      .insert(schema.pages)
      .values({
        key: page.key,
        // Published so routing works; the pages are simply empty.
        status: 'published',
        isSystem: page.isSystem,
        blocks: [],
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()

    if (!row) continue

    await db.insert(schema.pageTranslations).values(
      LOCALES.map((locale) => ({
        pageId: row.id,
        locale,
        title: page.title[locale],
        slug: page.slugs[locale],
      })),
    )
  }
}

async function main() {
  if (process.argv.includes('--reset')) {
    await reset()
  }

  console.log('Bootstrapping installation…')
  await seedAdmin()
  await seedTheme()
  await seedSettings()
  await seedNavigation()
  await seedPages()

  console.log('Done. Sign in at /admin and start adding content.')
  await client.end()
}

main().catch(async (error) => {
  console.error(error)
  await client.end()
  process.exit(1)
})
