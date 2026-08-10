import { z } from 'zod'

/**
 * Central, typed access to the environment.
 *
 * Only three variables are required (`DATABASE_URL`, `APP_URL`, `AUTH_SECRET`).
 * Everything else is optional and gates a feature: when the variables for a
 * feature are missing the feature reports itself as "not configured" and the
 * rest of the application keeps working. This is what makes payment providers
 * and the embedding pipeline non-blocking.
 */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))

const boolish = z
  .string()
  .trim()
  .optional()
  .transform((value) => value === 'true' || value === '1')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // --- required ------------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_URL: z
    .string()
    .min(1, 'APP_URL is required')
    .transform((value) => value.replace(/\/+$/, '')),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),

  // --- object storage ------------------------------------------------------
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_PREFIX: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.replace(/^\/+|\/+$/g, '') : '')),
  S3_PUBLIC_BASE_URL: optionalString,
  S3_FORCE_PATH_STYLE: boolish,

  // --- payments ------------------------------------------------------------
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,

  PAYPAL_CLIENT_ID: optionalString,
  PAYPAL_CLIENT_SECRET: optionalString,
  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),

  PESAPAL_CONSUMER_KEY: optionalString,
  PESAPAL_CONSUMER_SECRET: optionalString,
  PESAPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),

  MTN_MOMO_SUBSCRIPTION_KEY: optionalString,
  MTN_MOMO_API_USER: optionalString,
  MTN_MOMO_API_KEY: optionalString,
  MTN_MOMO_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  MTN_MOMO_TARGET_ENVIRONMENT: optionalString,

  AIRTEL_CLIENT_ID: optionalString,
  AIRTEL_CLIENT_SECRET: optionalString,
  AIRTEL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  AIRTEL_COUNTRY: z.string().trim().default('UG'),
  AIRTEL_CURRENCY: z.string().trim().default('UGX'),

  // --- embeddings & RAG ----------------------------------------------------
  EMBEDDINGS_API_KEY: optionalString,
  EMBEDDINGS_BASE_URL: z.string().trim().default('https://openrouter.ai/api/v1'),
  EMBEDDINGS_MODEL: z.string().trim().default('openai/text-embedding-3-small'),
  EMBEDDINGS_DIM: z.coerce.number().int().positive().default(1536),
  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_BASE_URL: z.string().trim().default('https://openrouter.ai/api/v1'),
  RAG_CHAT_MODEL: z.string().trim().default('anthropic/claude-3.5-haiku'),

  // --- mail ----------------------------------------------------------------
  SMTP_URL: optionalString,
  MAIL_FROM: z.string().trim().default('no-reply@localhost'),

  // --- jobs ----------------------------------------------------------------
  CRON_SECRET: optionalString,
})

type Env = z.infer<typeof envSchema>

/**
 * `SKIP_ENV_VALIDATION` lets `next build` run inside Docker without any real
 * credentials; the runtime container still validates on first access.
 */
function loadEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true') {
    return envSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://build:build@localhost:5432/build',
      APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'build-time-placeholder-secret-value',
    })
  }

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }

  return parsed.data
}

export const env = loadEnv()

/** Feature flags derived from the environment. */
export const features = {
  storage: Boolean(
    env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  ),
  embeddings: Boolean(env.EMBEDDINGS_API_KEY),
  ragChat: Boolean(env.EMBEDDINGS_API_KEY && env.OPENROUTER_API_KEY),
  mail: Boolean(env.SMTP_URL),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  paypal: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
  pesapal: Boolean(env.PESAPAL_CONSUMER_KEY && env.PESAPAL_CONSUMER_SECRET),
  mtn: Boolean(env.MTN_MOMO_SUBSCRIPTION_KEY && env.MTN_MOMO_API_USER && env.MTN_MOMO_API_KEY),
  airtel: Boolean(env.AIRTEL_CLIENT_ID && env.AIRTEL_CLIENT_SECRET),
} as const

export type FeatureName = keyof typeof features
