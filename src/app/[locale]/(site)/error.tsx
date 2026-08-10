'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/** Error boundary for the public site, inside the site chrome. */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next.js
    // withholds from the browser in production.
    console.error('[site] render failed:', error.digest ?? error.message)
  }, [error])

  return (
    <div className="container-narrow flex flex-col items-center gap-5 py-20 text-center md:py-28">
      <AlertTriangle className="size-10 text-warning" aria-hidden />
      <h1 className="text-title">{t('serverTitle')}</h1>
      <p className="max-w-prose text-muted-foreground">{t('serverText')}</p>
      {error.digest ? (
        <p className="text-small text-muted-foreground">
          <code>{error.digest}</code>
        </p>
      ) : null}
      <Button size="lg" className="mt-2" onClick={reset}>
        {t('retry')}
      </Button>
    </div>
  )
}
