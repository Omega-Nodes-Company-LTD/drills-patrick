# Deploying on Coolify

The application ships as a single Docker image with `output: standalone`.
Migrations run from the container entrypoint, so a redeploy always boots with
an up-to-date schema.

## 1. Database

Create a PostgreSQL 18 service with the `vector` extension available. Coolify's
own PostgreSQL service works; if the image does not ship pgvector, use
`pgvector/pgvector:pg18` as the service image.

The first migration runs `CREATE EXTENSION IF NOT EXISTS vector` and
`pg_trgm`, so the database user needs permission to create extensions (the
owner of the database is enough on most managed images).

## 2. Application

Create an **Application** from this Git repository:

- Build pack: **Dockerfile**
- Port: `3000`
- Health check path: `/api/health`

### Environment variables

Required:

```
DATABASE_URL=postgres://user:password@host:5432/database
APP_URL=https://your-domain.tld
AUTH_SECRET=<openssl rand -base64 48>
```

Recommended:

```
CRON_SECRET=<openssl rand -base64 32>
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=fsn1
S3_BUCKET=shared-bucket
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PREFIX=wells-company
S3_FORCE_PATH_STYLE=true
SMTP_URL=smtps://user:password@smtp.example.com:465
MAIL_FROM=Wells Company <no-reply@your-domain.tld>
```

Payments, embeddings and the chat assistant are optional — see `.env.example`.
Add only the providers you actually use; the others stay hidden.

`APP_URL` must match the public domain exactly: payment redirects, webhook
callbacks, canonical URLs and the sitemap are all derived from it.

## 3. First boot

The entrypoint applies migrations automatically. Bootstrap the installation
once, from a terminal on the container:

```bash
node -e "process.exit(0)"        # confirm you are on the app container
pnpm db:seed                     # or: pnpm create-admin you@example.com 'Password1'
```

If the image has no dev dependencies, use a one-off local run against the
production database instead:

```bash
DATABASE_URL='postgres://…' pnpm db:seed
```

Then sign in at `https://your-domain.tld/admin` and change the password.

## 4. Webhooks

Register these URLs with the providers you enabled:

| Provider | URL |
|---|---|
| Stripe | `https://your-domain.tld/api/webhooks/stripe` |
| PesaPal | registered automatically on the first checkout |
| MTN MoMo | `https://your-domain.tld/api/webhooks/mtn` |
| Airtel Money | `https://your-domain.tld/api/webhooks/airtel` |

PayPal needs no webhook: the order is captured when the donor returns.

For Stripe, copy the signing secret into `STRIPE_WEBHOOK_SECRET` — without it
the endpoint rejects every call.

## 5. Scheduled task

Add a Coolify scheduled task on the application, every 10 minutes:

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/reconcile-donations
```

It confirms mobile-money payments whose callback never arrived and closes
donations abandoned for more than 48 hours.

## 6. Storage notes

Hetzner Object Storage uses path-style addressing, so keep
`S3_FORCE_PATH_STYLE=true`. Uploaded objects are written with `public-read`;
if you serve the bucket through a CDN, set `S3_PUBLIC_BASE_URL` to the CDN
origin and Next.js will allow images from that host automatically.

Every object key is prefixed with `S3_PREFIX`, so several sites can share one
bucket without colliding.

## Operational notes

- **Migrations on boot.** Set `SKIP_MIGRATIONS=1` to disable, for instance when
  running several replicas and applying migrations separately.
- **Rate limiting** is in-process. With more than one replica, the limits apply
  per replica; move them to Redis if you scale out.
- **Backups.** Everything except uploaded files lives in PostgreSQL; back up
  the database and the S3 prefix.
- **Rolling back a theme.** Themes are versioned rows in the `themes` table;
  the admin edits the active one, and "Reset to defaults" restores the shipped
  palette.
