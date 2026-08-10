'use client'

import { FileQuestion } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

/**
 * Shown for `notFound()` inside the public site. It is a client component so it
 * can read the translations already provided by the locale layout, which also
 * keeps the header and footer around the message.
 */
export default function SiteNotFound() {
  const t = useTranslations('errors')

  return (
    <div className="container-narrow flex flex-col items-center gap-5 py-20 text-center md:py-28">
      <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-title">{t('notFoundTitle')}</h1>
      <p className="max-w-prose text-muted-foreground">{t('notFoundText')}</p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">{t('goHome')}</Link>
      </Button>
    </div>
  )
}
