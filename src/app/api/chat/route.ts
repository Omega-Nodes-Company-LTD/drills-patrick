import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { chatConversations, chatMessages } from '@/db/schema'
import { isLocale, locales } from '@/i18n/config'
import { isChatEnabled, retrieveContext, streamAnswer } from '@/lib/rag/chat'
import { clientIdentifier, rateLimit } from '@/lib/rate-limit'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  message: z.string().trim().min(2).max(1000),
  locale: z.enum(locales).default('en'),
  conversationId: z.string().uuid().nullish(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(10)
    .default([]),
})

/**
 * Streams an answer as plain text. The first line is a JSON header carrying the
 * conversation id and the citations, followed by `\n` and then the answer.
 */
export async function POST(request: Request) {
  if (!isChatEnabled()) {
    return NextResponse.json({ error: 'disabled' }, { status: 404 })
  }

  const settings = await getSiteSettings()
  if (!settings.features.chatAssistant) {
    return NextResponse.json({ error: 'disabled' }, { status: 404 })
  }

  const ip = await clientIdentifier()
  if (!rateLimit(`chat:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { message, history } = parsed.data
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : 'en'

  const { chunks, citations } = await retrieveContext(message, locale)

  let conversationId = parsed.data.conversationId ?? null
  if (!conversationId) {
    const [conversation] = await db
      .insert(chatConversations)
      .values({ locale, userAgent: request.headers.get('user-agent') ?? null })
      .returning({ id: chatConversations.id })
    conversationId = conversation?.id ?? null
  }

  if (conversationId) {
    await db.insert(chatMessages).values({ conversationId, role: 'user', content: message })
  }

  let answerStream: ReadableStream<Uint8Array>
  try {
    answerStream = await streamAnswer(message, history, locale, chunks)
  } catch (error) {
    console.error('[chat] upstream failed:', error)
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const header = `${JSON.stringify({ conversationId, citations })}\n`
  let answer = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(header))

      const reader = answerStream.getReader()
      const decoder = new TextDecoder()

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          answer += decoder.decode(value, { stream: true })
          controller.enqueue(value)
        }
      } catch (error) {
        console.error('[chat] stream aborted:', error)
      } finally {
        controller.close()

        if (conversationId && answer) {
          await db.insert(chatMessages).values({
            conversationId,
            role: 'assistant',
            content: answer,
            citations,
          })
          await db
            .update(chatConversations)
            .set({ lastMessageAt: new Date() })
            .where(eq(chatConversations.id, conversationId))
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
