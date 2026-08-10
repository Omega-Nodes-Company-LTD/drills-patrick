'use client'

import { Check, Link2, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/** Uses the Web Share API where available and falls back to copying the URL. */
export function ShareButtons({ title }: { title: string }) {
  const t = useTranslations('common')
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // The visitor dismissed the sheet — fall through to copying.
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-primary"
    >
      {copied ? (
        <Check className="size-4 text-success" aria-hidden />
      ) : typeof navigator !== 'undefined' && 'share' in navigator ? (
        <Share2 className="size-4" aria-hidden />
      ) : (
        <Link2 className="size-4" aria-hidden />
      )}
      {copied ? t('linkCopied') : t('share')}
    </button>
  )
}
