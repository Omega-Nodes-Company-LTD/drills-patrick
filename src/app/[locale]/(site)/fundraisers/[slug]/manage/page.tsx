import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { FundraiserManageForm } from '@/components/site/fundraiser-manage-form'
import { PageHeader } from '@/components/site/page-header'
import type { Locale } from '@/i18n/config'
import { getFundraiserByToken } from '@/lib/giving/fundraisers'
import { fromMinorUnits } from '@/lib/money'

export const dynamic = 'force-dynamic'

/** Never indexed: the URL carries a token that stands in for a password. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ManageFundraiserPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string }
  const { token } = await searchParams
  setRequestLocale(locale)

  const t = await getTranslations('fundraisers')
  const row = token ? await getFundraiserByToken(slug, token) : null

  if (!row || !token) {
    return (
      <>
        <PageHeader title={t('manageTitle')} />
        <div className="container-page max-w-2xl py-10 md:py-14">
          <p className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/8 p-4 text-sm">
            {t('badLink')}
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('manageTitle')} subtitle={row.title} />
      <div className="container-page max-w-2xl py-10 md:py-14">
        <FundraiserManageForm
          slug={row.slug}
          token={token}
          initial={{
            title: row.title,
            story: row.story,
            goalAmount: String(fromMinorUnits(row.goalAmountMinor, row.currency)),
            endsOn: row.endsOn ?? '',
            status: row.status,
          }}
        />
      </div>
    </>
  )
}
