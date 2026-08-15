'use client'

import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

type Citation = { title: string; url: string }
type Message = { role: 'user' | 'assistant'; content: string; citations?: Citation[] }

/**
 * Floating assistant. It only appears when the RAG feature is configured (the
 * layout decides), and it streams the answer as plain text with a JSON header
 * line carrying the citations.
 */
export function ChatWidget({ locale }: { locale: Locale }) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || pending) return

    setInput('')
    setMessages((current) => [...current, { role: 'user', content: question }])
    setPending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          locale,
          conversationId,
          history: messages.slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      })

      if (!response.ok || !response.body) throw new Error('request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let headerParsed = false
      let citations: Citation[] = []

      setMessages((current) => [...current, { role: 'assistant', content: '' }])

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        if (!headerParsed) {
          const newline = buffer.indexOf('\n')
          if (newline === -1) continue

          try {
            const header = JSON.parse(buffer.slice(0, newline)) as {
              conversationId: string | null
              citations: Citation[]
            }
            citations = header.citations ?? []
            if (header.conversationId) setConversationId(header.conversationId)
          } catch {
            // Header malformed — carry on with the text only.
          }

          buffer = buffer.slice(newline + 1)
          headerParsed = true
        }

        setMessages((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: buffer, citations }
          }
          return next
        })
      }
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: t('error') }])
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t('title') : t('open')}
        aria-expanded={open}
        // The bottom offset clears the home indicator: without the safe-area
        // inset the launcher sits inside the system gesture zone on a modern
        // iPhone and is effectively untappable.
        className="fixed bottom-[calc(1rem+var(--safe-bottom))] end-4 z-40 grid size-13 place-items-center rounded-full bg-primary text-primary-foreground shadow-token-lg transition-transform hover:scale-105 md:bottom-[calc(1.5rem+var(--safe-bottom))] md:end-6"
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <MessageCircle className="size-5" aria-hidden />
        )}
      </button>

      {open ? (
        // `z-50` rather than `z-40`: the sticky site header is also `z-40`, and
        // an open panel must not slide underneath it as the page scrolls.
        <div className="fixed inset-x-3 bottom-[calc(5rem+var(--safe-bottom))] z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-background shadow-token-lg sm:inset-x-auto sm:end-6 sm:w-[24rem] md:bottom-[calc(6rem+var(--safe-bottom))]">
          <header className="flex items-center justify-between gap-2 border-b border-border p-4">
            <p className="font-semibold">{t('title')}</p>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setConversationId(null)
                }}
                className="text-xs text-muted-foreground underline touch-target"
              >
                {t('clear')}
              </button>
            ) : null}
          </header>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('greeting')}</p>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'max-w-[85%] rounded-[var(--radius-md)] px-3 py-2 text-sm',
                  message.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground'
                    : 'self-start bg-muted',
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.citations && message.citations.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
                    <span className="text-xs opacity-70">{t('sources')}</span>
                    {message.citations.slice(0, 4).map((citation, position) => (
                      <a
                        key={position}
                        href={citation.url}
                        className="text-xs underline underline-offset-2"
                      >
                        {citation.title}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {pending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
          </div>

          <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) void send(event)
              }}
              rows={2}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              // `text-base` below `sm`: Safari zooms the viewport when a focused
              // control is under 16px, and this panel is `fixed`, so the zoom
              // leaves it hanging off the screen.
              className="flex-1 resize-none rounded-[var(--radius-sm)] border border-border bg-background px-3 py-2 text-base sm:text-sm"
            />
            <button
              type="submit"
              disabled={pending || input.trim().length < 2}
              aria-label={t('send')}
              className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground touch-target disabled:opacity-50"
            >
              <Send className="size-4" aria-hidden />
            </button>
          </form>

          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {t('disclaimer')}
          </p>
        </div>
      ) : null}
    </>
  )
}
