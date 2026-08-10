import 'server-only'
import QRCode from 'qrcode'
import { localeUrl } from '@/lib/seo'
import type { Locale } from '@/i18n/config'

/**
 * The QR sticker that goes on a well cover.
 *
 * SVG rather than PNG: the sticker is printed, sometimes enlarged onto a
 * metal plate, and a raster image at an unknown size is a gamble. High error
 * correction because the label will be scratched, dusty and rained on, and a
 * code that stops scanning after a season is a code nobody replaces.
 */
export async function faultReportQr(locale: Locale, slug: string): Promise<string> {
  return QRCode.toString(localeUrl(locale, `/report/${slug}`), {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
  })
}
