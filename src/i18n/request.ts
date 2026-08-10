import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isLocale } from './config'
import { routing } from './routing'

type Messages = Record<string, unknown>

/** Deep merge used to fall back to the default locale for missing keys. */
function merge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const current = result[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      result[key] = merge(current as Messages, value as Messages)
    } else if (value !== undefined && value !== '') {
      result[key] = value
    }
  }

  return result
}

async function loadMessages(locale: string): Promise<Messages> {
  const mod = await import(`../messages/${locale}.json`)
  return mod.default as Messages
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = isLocale(requested) ? requested : routing.defaultLocale

  const base = await loadMessages(defaultLocale)
  const messages = locale === defaultLocale ? base : merge(base, await loadMessages(locale))

  return {
    locale,
    messages,
    // Luganda has no dedicated CLDR data in every runtime; format with en-UG.
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
      },
    },
    now: new Date(),
    timeZone: 'Africa/Kampala',
    getMessageFallback({ key, namespace }) {
      return [namespace, key].filter(Boolean).join('.')
    },
    onError() {
      // Missing keys fall back to the default locale via `merge`; stay quiet.
    },
  }
})
