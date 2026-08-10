import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { env, features } from '@/env'
import { localeLabels, type Locale } from '@/i18n/config'
import { embedOne } from '@/lib/embeddings/client'
import { getSiteSettings } from '@/lib/settings/service'

/**
 * Retrieval-augmented assistant.
 *
 * It answers only from indexed site content and always returns the sources it
 * used. Without `EMBEDDINGS_API_KEY` and `OPENROUTER_API_KEY` the feature is
 * disabled and the widget is never rendered.
 */

export type Citation = {
  title: string
  url: string
  entityType: string
  entityId: string
}

export type ChatMessageInput = { role: 'user' | 'assistant'; content: string }

export function isChatEnabled(): boolean {
  return features.ragChat
}

type ChunkRow = {
  entity_type: string
  entity_id: string
  title: string
  url: string
  content: string
  distance: number
}

/** Top matching chunks for a question, with a relevance cut-off. */
export async function retrieveContext(
  question: string,
  locale: Locale,
  limit = 6,
): Promise<{ chunks: ChunkRow[]; citations: Citation[] }> {
  const vector = await embedOne(question)
  if (!vector) return { chunks: [], citations: [] }

  const literal = `[${vector.join(',')}]`

  const rows = (await db.execute<ChunkRow>(sql`
    SELECT entity_type, entity_id, title, url, content,
           embedding <=> ${literal}::vector AS distance
    FROM content_embeddings
    WHERE locale = ${locale} AND embedding IS NOT NULL
    ORDER BY distance
    LIMIT ${limit}
  `)) as unknown as ChunkRow[]

  // Cosine distance above 0.75 means the chunk is not really about the question.
  const relevant = rows.filter((row) => Number(row.distance) < 0.75)

  const citations: Citation[] = []
  const seen = new Set<string>()
  for (const row of relevant) {
    const key = `${row.entity_type}:${row.entity_id}`
    if (seen.has(key)) continue
    seen.add(key)
    citations.push({
      title: row.title,
      url: row.url,
      entityType: row.entity_type,
      entityId: row.entity_id,
    })
  }

  return { chunks: relevant, citations }
}

async function systemPrompt(locale: Locale, chunks: ChunkRow[]): Promise<string> {
  const settings = await getSiteSettings()

  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.content}`)
    .join('\n\n')

  return [
    `You are the assistant of ${settings.siteName}, a water-well drilling company working with NGOs.`,
    `Answer in ${localeLabels[locale]}.`,
    'Use only the context below. If the answer is not in it, say plainly that the site does not cover it and suggest contacting the team.',
    'Be concise: at most three short paragraphs. Never invent figures, prices or dates.',
    '',
    context ? `Context:\n${context}` : 'Context: (empty)',
  ].join('\n')
}

/**
 * Streams the answer as plain text chunks. The caller is responsible for
 * sending the citations to the client.
 */
export async function streamAnswer(
  question: string,
  history: ChatMessageInput[],
  locale: Locale,
  chunks: ChunkRow[],
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(
    `${env.OPENROUTER_BASE_URL.replace(/\/+$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.APP_URL,
        'X-Title': 'Website assistant',
      },
      body: JSON.stringify({
        model: env.RAG_CHAT_MODEL,
        stream: true,
        max_tokens: 700,
        temperature: 0.2,
        messages: [
          { role: 'system', content: await systemPrompt(locale, chunks) },
          ...history.slice(-6),
          { role: 'user', content: question },
        ],
      }),
    },
  )

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status} ${await response.text()}`)
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const reader = response.body.getReader()
  let buffer = ''

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()

      if (done) {
        controller.close()
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          controller.close()
          return
        }

        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[]
          }
          const text = parsed.choices?.[0]?.delta?.content
          if (text) controller.enqueue(encoder.encode(text))
        } catch {
          // Keep-alive comments and partial frames are skipped.
        }
      }
    },
    cancel() {
      void reader.cancel()
    },
  })
}
