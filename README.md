# Wells Company — website and administration

Multilingual website with a full administration area for a Ugandan water-well
drilling company working with NGOs, foundations and district authorities.

Everything the site shows is editable from `/admin`: pages are composed of
sections, colours and spacing are design tokens stored in the database, text
fields are edited with a WYSIWYG editor in five languages, and images live in a
shared Hetzner S3 bucket under a per-site prefix.

A fresh installation starts **empty** — no demo content. The bootstrap only
creates an administrator account, the default theme, the settings row, the
three menus and five blank pages.

---

## Stack

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions), TypeScript strict |
| Styling | Tailwind CSS v4 mapped onto database-driven CSS custom properties |
| Database | PostgreSQL 18 + `pgvector`, Drizzle ORM |
| i18n | `next-intl` — English, French, Italian, German, Luganda |
| Editor | TipTap, output sanitised with `sanitize-html` before storage |
| Storage | S3-compatible (Hetzner Object Storage) with `sharp` derivatives |
| Auth | Signed JWT session cookie (`jose`) + bcrypt, three roles |
| Payments | Stripe, PesaPal, MTN MoMo, Airtel Money, PayPal, bank transfer |
| Search | Hybrid: PostgreSQL keyword search + `pgvector` semantic search |

---

## Getting started

```bash
cp .env.example .env          # fill in at least DATABASE_URL, APP_URL, AUTH_SECRET
docker compose up -d          # PostgreSQL 18 with pgvector on port 5433
pnpm install
pnpm db:migrate               # applies migrations, creates the vector extension
pnpm db:seed                  # bootstraps the installation (no content)
pnpm dev
```

Sign in at <http://localhost:3000/admin>. The seed prints the credentials it
created; change the password immediately. Override them with
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` and
`SEED_SITE_NAME`, or create an account later with:

```bash
pnpm create-admin you@example.com 'YourStrongPassword1'
```

### Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js development, build, production server |
| `pnpm db:generate` | Generate a migration from the Drizzle schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed [--reset]` | Bootstrap an installation (`--reset` wipes first) |
| `pnpm create-admin` | Create or reset an administrator |
| `pnpm reindex` | Rebuild the vector index for published content |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Smoke tests (Playwright, desktop + mobile) |
| `pnpm typecheck` / `pnpm lint` | Static checks |

---

## What is configurable, and where

**Appearance → Theme.** Light and dark palettes, body and heading fonts, base
font size, heading scale ratio, line height, letter spacing, corner radius,
shadow strength, border width, the spacing unit, the page gutter, content and
prose widths, and the five section-spacing presets. Saving updates the live
site without a rebuild: the tokens are rendered into a stylesheet in `<head>`
and Tailwind's `--color-*`, `--font-*`, `--radius-*` and `--spacing`
namespaces are mapped onto them.

**Appearance → Navigation.** Header, footer and legal menus, with translated
labels, external-link and highlight flags.

**Content → Pages.** Pages are built from sections: hero, text, impact figures,
projects, articles, campaigns, donation box, gallery, partners, testimonials,
FAQ, how-it-works, call to action, map, video and contact form. Each section
has its own spacing above and below, width, background tone and anchor id — so
spacing is adjustable globally *and* per section.

**Settings.** Site name, tagline and description, logos and social image,
active languages and default language, contact details, social links, SEO
defaults and analytics, legal details, currencies and suggested amounts, bank
transfer details, and feature toggles (blog, projects, donations, newsletter,
chat assistant, semantic search).

Translated fields appear with a small language switch; a green marker shows
which languages already have content. Missing translations fall back to the
default language rather than rendering blank.

---

## Optional integrations

Only `DATABASE_URL`, `APP_URL` and `AUTH_SECRET` are required. Everything else
enables a feature when present and is cleanly skipped when absent — the admin
dashboard lists what is configured.

- **Object storage** (`S3_*`): without it the media library explains that
  uploads are disabled; the rest of the admin works normally. `S3_PREFIX`
  scopes every object key, so one bucket can host several sites.
- **Payments**: each provider appears in the donation form only when its
  variables are set. Bank transfer is always available, so the form is never
  empty. Mobile-money payments are confirmed by polling as well as callbacks —
  see the reconciliation job below.
- **Embeddings** (`EMBEDDINGS_API_KEY`): enables semantic search. Without it,
  search falls back to keyword matching.
- **Chat assistant** (`OPENROUTER_API_KEY` + embeddings): renders the RAG
  widget, which answers only from indexed content and cites its sources.
- **Email** (`SMTP_URL`): receipts, bank-transfer instructions and internal
  notifications. Without it, donations and form submissions still succeed.

### A note on the embedding endpoint

`EMBEDDINGS_BASE_URL` defaults to OpenRouter, but the client speaks the plain
OpenAI-compatible `/embeddings` protocol. If OpenRouter does not serve
embeddings for your account, point the variable at any compatible endpoint
(Voyage, OpenAI, a self-hosted model) — no code changes are needed.

The vector column is `vector(1536)`, matching `text-embedding-3-small`. A model
with a different dimension needs a migration that alters
`content_embeddings.embedding`; the client refuses to store mismatched vectors
rather than corrupting the index.

---

## Scheduled job

Mobile-money callbacks are unreliable and browsers get closed mid-payment, so
open donations are re-checked against their provider:

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/reconcile-donations
```

Every ten minutes is plenty. Donations still open after 48 hours are cancelled.

---

## Project layout

```
src/app/[locale]/(site)      public site
src/app/[locale]/admin       login + (dashboard) group with the admin chrome
src/app/api                  webhooks, uploads, chat, health, cron
src/components/blocks        section renderers
src/components/admin         admin UI, including the section and theme editors
src/db/schema                Drizzle schema, one file per domain
src/lib/payments             provider registry and the six providers
src/lib/embeddings           embedding client and the indexing pipeline
src/messages                 one JSON file per language
```

Translations use two mechanisms, each where it fits: structured entities
(articles, projects, campaigns) have a `*_translations` table with a slug and
SEO metadata per language, while page sections are defined once and carry i18n
objects on their text fields — so a layout is arranged once and only the copy
is translated.

Deployment instructions are in [DEPLOY.md](./DEPLOY.md).
