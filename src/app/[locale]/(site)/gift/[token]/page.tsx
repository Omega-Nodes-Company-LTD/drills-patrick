import { Droplets } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/site/page-header'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/config'
import { giftCardByToken } from '@/lib/giving/cards'

export const dynamic = 'force-dynamic'

/** Never indexed: the URL is the token. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function GiftCardPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = (await params) as { locale: Locale; token: string }
  setRequestLocale(locale)

  const t = await getTranslations('gift')
  const card = await giftCardByToken(token)

  if (!card) {
    return (
      <>
        <PageHeader title={t('cardTitle')} />
        <div className="container-page max-w-xl py-10 md:py-14">
          <p className="rounded-[var(--radius-md)] border border-border bg-muted p-4 text-sm">
            {t('notFound')}
          </p>
        </div>
      </>
    )
  }

  return (
    <div className="container-page max-w-xl py-14">
      <article className="flex flex-col items-center gap-6 rounded-[var(--radius-xl)] border border-border bg-surface p-8 text-center">
        <Droplets className="size-12 text-primary" aria-hidden />

        <h1 className="font-heading text-heading font-bold">{t('cardTitle')}</h1>
        <p className="text-lg">{card.recipientName}</p>

        {card.message ? (
          <blockquote className="border-s-2 border-primary ps-4 text-start text-base whitespace-pre-wrap">
            {card.message}
          </blockquote>
        ) : null}

        <p className="text-sm text-muted-foreground">{t('from', { name: card.senderName })}</p>

        <Button asChild>
          <Link href="/projects">{t('seeWork')}</Link>
        </Button>
      </article>
    </div>
  )
}
