import sanitize from 'sanitize-html'

/**
 * Upload safety checks that do not need the database or S3, so they can be
 * unit tested on their own.
 *
 * The browser-declared `Content-Type` of a multipart part is chosen by whoever
 * sends the request. Trusting it means a `.png` that is really an HTML page
 * ends up served from the bucket under a content type the browser will render.
 */

/** Magic-byte signatures for the types that have one. */
const SIGNATURES: { mime: string; test: (bytes: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: 'image/gif', test: (b) => b.subarray(0, 6).toString('latin1').startsWith('GIF8') },
  {
    mime: 'image/webp',
    test: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    mime: 'image/avif',
    test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' && b.subarray(8, 12).toString('latin1').startsWith('avi'),
  },
  { mime: 'application/pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
]

/** ZIP container: docx and xlsx are both ZIPs, as is any other OOXML file. */
const isZip = (bytes: Buffer) =>
  bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)

/** Legacy Office compound file (.doc, .xls). */
const isOle = (bytes: Buffer) =>
  bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))

const ZIP_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const OLE_TYPES = new Set(['application/msword', 'application/vnd.ms-excel'])

/** Types carried by plain text, which has no signature to check. */
const TEXT_TYPES = new Set(['text/csv', 'text/plain'])

/**
 * True when the bytes match the declared type. Text and SVG have no signature,
 * so they are checked for the one thing that matters: that they do not start
 * with markup a browser would treat as HTML.
 */
export function matchesDeclaredType(bytes: Buffer, mimeType: string): boolean {
  if (bytes.length < 12) return TEXT_TYPES.has(mimeType) && bytes.length > 0

  const detected = SIGNATURES.find((signature) => signature.test(bytes))
  if (detected) return detected.mime === mimeType

  if (ZIP_TYPES.has(mimeType)) return isZip(bytes)
  if (OLE_TYPES.has(mimeType)) return isOle(bytes)

  if (mimeType === 'image/svg+xml' || TEXT_TYPES.has(mimeType)) {
    const head = bytes.subarray(0, 512).toString('utf8').trimStart().toLowerCase()
    if (head.startsWith('<!doctype html') || head.startsWith('<html')) return false
    return mimeType !== 'image/svg+xml' || head.includes('<svg')
  }

  // A signature-bearing format that produced no match is not what it claims.
  return false
}

/**
 * Strips everything executable from an SVG.
 *
 * Assets are served straight from the bucket, so an SVG with a `<script>` in
 * it is stored XSS on the storage origin. Logos and icons only need shapes,
 * so the allowlist is narrow and anything outside it is dropped.
 */
export function sanitizeSvg(svg: string): string {
  return sanitize(svg, {
    allowedTags: [
      'svg',
      'g',
      'defs',
      'symbol',
      'use',
      'title',
      'desc',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'linearGradient',
      'radialGradient',
      'stop',
      'clipPath',
      'mask',
      'pattern',
      'filter',
      'feGaussianBlur',
      'feOffset',
      'feBlend',
      'feColorMatrix',
      'feMerge',
      'feMergeNode',
    ],
    allowedAttributes: {
      '*': [
        'id',
        'class',
        'style',
        'transform',
        'fill',
        'fill-rule',
        'fill-opacity',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-dasharray',
        'stroke-opacity',
        'opacity',
        'clip-path',
        'clip-rule',
        'mask',
        'filter',
        'x',
        'y',
        'x1',
        'x2',
        'y1',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'width',
        'height',
        'd',
        'points',
        'offset',
        'stop-color',
        'stop-opacity',
        'gradientUnits',
        'gradientTransform',
        'patternUnits',
        'viewBox',
        'preserveAspectRatio',
        'xmlns',
        'xmlns:xlink',
        'version',
        'font-family',
        'font-size',
        'font-weight',
        'text-anchor',
        'dominant-baseline',
      ],
      use: ['href'],
    },
    // No http(s): an external reference would phone home from a visitor's page.
    allowedSchemes: [],
    allowedSchemesAppliedToAttributes: ['href', 'xlink:href', 'src'],
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  })
}
