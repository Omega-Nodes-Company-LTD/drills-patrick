'use client'

import { Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveCampaign } from '@/app/actions/admin/content'
import { LocaleFields } from '@/components/admin/locale-fields'
import { MediaPicker } from '@/components/admin/media/media-picker'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { locales, type Locale } from '@/i18n/config'
import { useRouter } from '@/i18n/navigation'
import { slugify } from '@/lib/utils'

type Translation = {
  title: string
  slug: string
  summary: string
  contentHtml: string
  seoTitle: string
  seoDescription: string
}

const empty: Translation = {
  title: '',
  slug: '',
  summary: '',
  contentHtml: '',
  seoTitle: '',
  seoDescription: '',
}

export type CampaignFormValues = {
  id: string
  coverId: string | null
  projectId: string | null
  status: 'draft' | 'published' | 'archived'
  isFeatured: boolean
  goalAmount: string
  offlineAmount: string
  currency: string
  startsOn: string
  endsOn: string
  suggestedAmounts: string
  allowCustomAmount: boolean
  sortOrder: string
  translations: Partial<Record<Locale, Translation>>
}

export function CampaignForm({
  initial,
  currencies,
  projects,
  storageEnabled,
}: {
  initial?: CampaignFormValues
  currencies: string[]
  projects: { id: string; title: string }[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tCampaigns = useTranslations('campaigns')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [values, setValues] = useState({
    coverId: initial?.coverId ?? null,
    projectId: initial?.projectId ?? '',
    status: initial?.status ?? ('draft' as const),
    isFeatured: initial?.isFeatured ?? false,
    goalAmount: initial?.goalAmount ?? '0',
    offlineAmount: initial?.offlineAmount ?? '0',
    currency: initial?.currency ?? currencies[0] ?? 'EUR',
    startsOn: initial?.startsOn ?? '',
    endsOn: initial?.endsOn ?? '',
    suggestedAmounts: initial?.suggestedAmounts ?? '',
    allowCustomAmount: initial?.allowCustomAmount ?? true,
    sortOrder: initial?.sortOrder ?? '0',
  })

  const [translations, setTranslations] = useState<Record<Locale, Translation>>(() =>
    Object.fromEntries(
      locales.map((locale) => [locale, initial?.translations[locale] ?? { ...empty }]),
    ) as Record<Locale, Translation>,
  )

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  function updateTranslation(locale: Locale, patch: Partial<Translation>) {
    setTranslations((current) => ({ ...current, [locale]: { ...current[locale], ...patch } }))
  }

  function submit() {
    startTransition(async () => {
      const result = await saveCampaign({
        id: initial?.id,
        coverId: values.coverId,
        projectId: values.projectId || null,
        status: values.status,
        isFeatured: values.isFeatured,
        goalAmount: Number(values.goalAmount || 0),
        offlineAmount: Number(values.offlineAmount || 0),
        currency: values.currency,
        startsOn: values.startsOn || null,
        endsOn: values.endsOn || null,
        allowCustomAmount: values.allowCustomAmount,
        sortOrder: Number(values.sortOrder || 0),
        suggestedAmounts: values.suggestedAmounts
          .split(',')
          .map((entry) => Number(entry.trim()))
          .filter((entry) => Number.isFinite(entry) && entry > 0),
        translations: Object.fromEntries(
          locales
            .filter((locale) => translations[locale].title.trim())
            .map((locale) => [locale, translations[locale]]),
        ),
      })

      if (result.ok) {
        toast.success(tCommon('success.saved'))
        router.push('/admin/campaigns')
        router.refresh()
      } else {
        toast.error(
          result.error === 'missing_translation' ? t('missingTranslation') : tCommon('error.generic'),
        )
      }
    })
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Card>
        <CardContent className="pt-5">
          <LocaleFields isFilled={(locale) => Boolean(translations[locale].title.trim())}>
            {(locale) => (
              <>
                <Field label={`${tCampaigns('title')} — ${locale}`} htmlFor={`c-title-${locale}`} required>
                  <Input
                    id={`c-title-${locale}`}
                    value={translations[locale].title}
                    onChange={(event) => {
                      const title = event.target.value
                      updateTranslation(locale, {
                        title,
                        slug:
                          translations[locale].slug &&
                          translations[locale].slug !== slugify(translations[locale].title)
                            ? translations[locale].slug
                            : slugify(title),
                      })
                    }}
                  />
                </Field>

                <Field label={t('slug')} htmlFor={`c-slug-${locale}`}>
                  <Input
                    id={`c-slug-${locale}`}
                    value={translations[locale].slug}
                    onChange={(event) => updateTranslation(locale, { slug: event.target.value })}
                  />
                </Field>

                <Field label={tCampaigns('subtitle')} htmlFor={`c-summary-${locale}`}>
                  <Textarea
                    id={`c-summary-${locale}`}
                    rows={2}
                    value={translations[locale].summary}
                    onChange={(event) => updateTranslation(locale, { summary: event.target.value })}
                  />
                </Field>

                <RichTextEditor
                  value={translations[locale].contentHtml}
                  onChange={(html) => updateTranslation(locale, { contentHtml: html })}
                  storageEnabled={storageEnabled}
                />
              </>
            )}
          </LocaleFields>
        </CardContent>
      </Card>

      <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('status')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select
              value={values.status}
              onChange={(event) => set('status', event.target.value as never)}
              aria-label={t('status')}
            >
              <option value="draft">{t('draft')}</option>
              <option value="published">{t('published')}</option>
              <option value="archived">{t('archived')}</option>
            </Select>

            <label className="flex items-center justify-between gap-3 text-sm">
              {t('featured')}
              <Switch
                checked={values.isFeatured}
                onCheckedChange={(checked) => set('isFeatured', checked)}
              />
            </label>

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {tCommon('save')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tCampaigns('goal')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label={tCampaigns('goal')} htmlFor="goalAmount">
              <Input
                id="goalAmount"
                inputMode="decimal"
                value={values.goalAmount}
                onChange={(event) => set('goalAmount', event.target.value)}
              />
            </Field>

            <Field label={tCampaigns('raised')} htmlFor="offlineAmount" hint="offline / grants">
              <Input
                id="offlineAmount"
                inputMode="decimal"
                value={values.offlineAmount}
                onChange={(event) => set('offlineAmount', event.target.value)}
              />
            </Field>

            <Field label="Currency" htmlFor="c-currency">
              <Select
                id="c-currency"
                value={values.currency}
                onChange={(event) => set('currency', event.target.value)}
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Suggested amounts"
              htmlFor="suggestedAmounts"
              hint="25, 50, 100, 250"
            >
              <Input
                id="suggestedAmounts"
                value={values.suggestedAmounts}
                onChange={(event) => set('suggestedAmounts', event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="startsOn">
                <Input
                  id="startsOn"
                  type="date"
                  value={values.startsOn}
                  onChange={(event) => set('startsOn', event.target.value)}
                />
              </Field>
              <Field label="To" htmlFor="endsOn">
                <Input
                  id="endsOn"
                  type="date"
                  value={values.endsOn}
                  onChange={(event) => set('endsOn', event.target.value)}
                />
              </Field>
            </div>

            <Field label={tCampaigns('linkedProject')} htmlFor="projectId">
              <Select
                id="projectId"
                value={values.projectId}
                onChange={(event) => set('projectId', event.target.value)}
              >
                <option value="">—</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('coverImage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MediaPicker
              value={values.coverId}
              onChange={(id) => set('coverId', id)}
              storageEnabled={storageEnabled}
            />
          </CardContent>
        </Card>
      </aside>
    </form>
  )
}
