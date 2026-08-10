import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  // The default locale is served without a prefix (`/projects`), every other
  // locale is prefixed (`/fr/projects`).
  localePrefix: 'as-needed',
  localeDetection: true,
})
