'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/** Error boundary for the admin, so a failed query keeps the sidebar usable. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    console.error('[admin] render failed:', error.digest ?? error.message)
  }, [error])

  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] border border-danger/40 bg-danger/8 p-8">
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <h1 className="text-heading">{t('serverTitle')}</h1>
      <p className="text-muted-foreground">{t('serverText')}</p>
      {error.digest ? (
        <p className="text-small text-muted-foreground">
          <code>{error.digest}</code>
        </p>
      ) : null}
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  )
}
