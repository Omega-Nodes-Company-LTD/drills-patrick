import { describe, expect, it } from 'vitest'
import { resolvePublicBaseUrl } from '@/lib/storage/urls'

const ENDPOINT = 'https://fsn1.your-objectstorage.com'
const BUCKET = 'shared-bucket'

describe('resolvePublicBaseUrl', () => {
  it('puts the bucket in the path when path style is on', () => {
    expect(resolvePublicBaseUrl({ endpoint: ENDPOINT, bucket: BUCKET, forcePathStyle: true })).toBe(
      'https://fsn1.your-objectstorage.com/shared-bucket',
    )
  })

  it('puts the bucket in the host when path style is off', () => {
    // The regression this file exists for: the bucket used to drop out of the
    // URL entirely, leaving the object prefix to be read as the bucket name.
    // Uploads kept working — the SDK does this arithmetic itself — so it only
    // ever showed up as NoSuchBucket on the public URL.
    expect(resolvePublicBaseUrl({ endpoint: ENDPOINT, bucket: BUCKET, forcePathStyle: false })).toBe(
      'https://shared-bucket.fsn1.your-objectstorage.com',
    )
  })

  it('names the bucket exactly once when the endpoint already carries it', () => {
    expect(
      resolvePublicBaseUrl({
        endpoint: 'https://shared-bucket.fsn1.your-objectstorage.com',
        bucket: BUCKET,
        forcePathStyle: false,
      }),
    ).toBe('https://shared-bucket.fsn1.your-objectstorage.com')
  })

  it('lets an explicit public base url win, CDN or otherwise', () => {
    expect(
      resolvePublicBaseUrl({
        publicBaseUrl: 'https://cdn.example.org/',
        endpoint: ENDPOINT,
        bucket: BUCKET,
        forcePathStyle: true,
      }),
    ).toBe('https://cdn.example.org')
  })

  it('strips trailing slashes so keys are never joined by a double slash', () => {
    expect(
      resolvePublicBaseUrl({ endpoint: `${ENDPOINT}///`, bucket: BUCKET, forcePathStyle: true }),
    ).toBe('https://fsn1.your-objectstorage.com/shared-bucket')
  })

  it('returns nothing when storage is not configured', () => {
    expect(resolvePublicBaseUrl({})).toBe('')
    expect(resolvePublicBaseUrl({ endpoint: ENDPOINT })).toBe('')
    expect(resolvePublicBaseUrl({ bucket: BUCKET })).toBe('')
  })

  it('passes an unparseable endpoint through rather than inventing a host', () => {
    expect(
      resolvePublicBaseUrl({ endpoint: 'not a url', bucket: BUCKET, forcePathStyle: false }),
    ).toBe('not a url')
  })

  it('keeps a non-default port and scheme intact', () => {
    expect(
      resolvePublicBaseUrl({
        endpoint: 'http://minio.local:9000',
        bucket: BUCKET,
        forcePathStyle: false,
      }),
    ).toBe('http://shared-bucket.minio.local:9000')
  })
})
