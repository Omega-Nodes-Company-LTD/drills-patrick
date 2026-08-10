import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { CampaignForm } from '@/components/admin/campaign-form'
import { features } from '@/env'
import type { Locale } from '@/i18n/config'
import { adminGetCampaign, adminProjectOptions } from '@/lib/admin/queries'
import { requirePermission } from '@/lib/auth/guard'
import { fromMinorUnits } from '@/lib/money'
import { getSiteSettings } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = (await params) as { locale: Locale; id: string }
  setRequestLocale(locale)
  await requirePermission('content')

  const [t, record, settings, projects] = await Promise.all([
    getTranslations('admin.nav'),
    adminGetCampaign(id),
    getSiteSettings(),
    adminProjectOptions(),
  ])

  if (!record) notFound()

  const { campaign } = record

  const translations = Object.fromEntries(
    record.translations.map((translation) => [
      translation.locale,
      {
        title: translation.title,
        slug: translation.slug,
        summary: translation.summary ?? '',
        contentHtml: translation.contentHtml,
        seoTitle: translation.seoTitle ?? '',
        seoDescription: translation.seoDescription ?? '',
      },
    ]),
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('campaigns')} />
      <CampaignForm
        currencies={settings.donations.currencies}
        projects={projects}
        storageEnabled={features.storage}
        initial={{
          id: campaign.id,
          coverId: campaign.coverId,
          projectId: campaign.projectId,
          status: campaign.status,
          isFeatured: campaign.isFeatured,
          goalAmount: String(fromMinorUnits(campaign.goalAmount, campaign.currency)),
          offlineAmount: String(fromMinorUnits(campaign.offlineAmount, campaign.currency)),
          currency: campaign.currency,
          startsOn: campaign.startsOn ?? '',
          endsOn: campaign.endsOn ?? '',
          suggestedAmounts: (campaign.suggestedAmounts ?? [])
            .map((amount) => fromMinorUnits(amount, campaign.currency))
            .join(', '),
          allowCustomAmount: campaign.allowCustomAmount,
          sortOrder: String(campaign.sortOrder),
          translations,
        }}
      />
    </div>
  )
}
