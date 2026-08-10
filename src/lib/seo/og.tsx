import { ImageResponse } from 'next/og'
import { getActiveTheme } from '@/lib/settings/service'

/**
 * Fallback social card, drawn from the configured theme.
 *
 * Most entities will have a cover photo, and a photograph of the actual water
 * point beats anything generated. This is for the ones that do not: without
 * it a shared link shows the site-wide image for every article, which tells a
 * reader nothing about what they are about to open.
 *
 * `next/og` runs in a constrained runtime — no external fonts are fetched, so
 * the card uses the system stack rather than blocking on a download that the
 * CSP would refuse anyway.
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export async function renderOgImage(params: {
  title: string
  eyebrow?: string | null
  footer?: string | null
}) {
  // The card follows the configured palette, so a rebranded site does not
  // keep sharing links in the old colours.
  const theme = await getActiveTheme().catch(() => null)
  const palette = theme?.tokens.colors.light

  const primary = palette?.primary ?? '#0a6d8f'
  const surface = palette?.background ?? '#ffffff'
  const ink = palette?.foreground ?? '#0f1c26'

  // Long titles shrink rather than overflow the card.
  const title = params.title.trim() || ' '
  const fontSize = title.length > 90 ? 52 : title.length > 55 ? 64 : 76

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: surface,
          color: ink,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {params.eyebrow ? (
            <div
              style={{
                fontSize: 28,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: primary,
              }}
            >
              {params.eyebrow}
            </div>
          ) : null}
          <div style={{ fontSize, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 96, height: 10, borderRadius: 999, background: primary }} />
          {params.footer ? <div style={{ fontSize: 30, opacity: 0.75 }}>{params.footer}</div> : null}
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
