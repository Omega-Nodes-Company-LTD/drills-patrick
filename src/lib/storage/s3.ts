import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env, features } from '@/env'

/**
 * S3 client for Hetzner Object Storage (or any S3-compatible endpoint).
 * When the credentials are missing every helper throws a descriptive error and
 * the admin surfaces the integration as "not configured" instead of crashing.
 */

let client: S3Client | null = null

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'Object storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.',
    )
    this.name = 'StorageNotConfiguredError'
  }
}

export function getS3Client(): S3Client {
  if (!features.storage) throw new StorageNotConfiguredError()

  client ??= new S3Client({
    region: env.S3_REGION ?? 'auto',
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  })

  return client
}

export function bucketName(): string {
  if (!env.S3_BUCKET) throw new StorageNotConfiguredError()
  return env.S3_BUCKET
}

export async function putObject(params: {
  key: string
  body: Buffer | Uint8Array
  contentType: string
  cacheControl?: string
}): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      // Immutable names (uuid prefixed) let us cache aggressively.
      CacheControl: params.cacheControl ?? 'public, max-age=31536000, immutable',
      ACL: 'public-read',
    }),
  )
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return

  await getS3Client().send(
    new DeleteObjectsCommand({
      Bucket: bucketName(),
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  )
}

/** Temporary URL for objects that are not publicly readable. */
export async function signedObjectUrl(key: string, expiresIn = 900): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucketName(), Key: key })
  return getSignedUrl(getS3Client(), command, { expiresIn })
}

/** Used by the admin "test connection" button. */
export async function checkStorageConnection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!features.storage) {
    return { ok: false, error: 'Object storage credentials are not set.' }
  }

  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: bucketName() }))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
