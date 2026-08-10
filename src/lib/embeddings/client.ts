import 'server-only'
import { env, features } from '@/env'

/**
 * Embedding client speaking the OpenAI-compatible `/embeddings` protocol.
 *
 * `EMBEDDINGS_BASE_URL` defaults to OpenRouter, but any compatible endpoint
 * works — point it elsewhere and nothing in the codebase changes. Without an
 * API key the whole feature reports itself as disabled and the site falls back
 * to keyword search.
 */

export function isEmbeddingsEnabled(): boolean {
  return features.embeddings
}

export function embeddingDimensions(): number {
  return env.EMBEDDINGS_DIM
}

export class EmbeddingError extends Error {}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!features.embeddings) throw new EmbeddingError('Embeddings are not configured')
  if (texts.length === 0) return []

  const response = await fetch(`${env.EMBEDDINGS_BASE_URL.replace(/\/+$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: env.EMBEDDINGS_MODEL, input: texts }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new EmbeddingError(
      `Embedding request failed: ${response.status} ${await response.text()}`,
    )
  }

  const data = (await response.json()) as {
    data?: { embedding: number[]; index: number }[]
  }

  if (!data.data || data.data.length !== texts.length) {
    throw new EmbeddingError('Embedding response did not match the number of inputs')
  }

  const ordered = [...data.data].sort((a, b) => a.index - b.index)

  for (const entry of ordered) {
    if (entry.embedding.length !== env.EMBEDDINGS_DIM) {
      throw new EmbeddingError(
        `Model returned ${entry.embedding.length} dimensions but the schema expects ${env.EMBEDDINGS_DIM}. ` +
          'Change EMBEDDINGS_MODEL or migrate the content_embeddings.embedding column.',
      )
    }
  }

  return ordered.map((entry) => entry.embedding)
}

export async function embedOne(text: string): Promise<number[] | null> {
  try {
    const [vector] = await embedTexts([text])
    return vector ?? null
  } catch (error) {
    console.error('[embeddings] request failed:', error)
    return null
  }
}

/** Used by the admin integrations panel. */
export async function checkEmbeddingsConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!features.embeddings) return { ok: false, error: 'EMBEDDINGS_API_KEY is not set.' }

  try {
    await embedTexts(['connection test'])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
