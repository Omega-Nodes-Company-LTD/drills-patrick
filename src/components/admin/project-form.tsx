'use client'

import { Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveProject } from '@/app/actions/admin/content'
import { LocaleFields } from '@/components/admin/locale-fields'
import { SeoFields } from '@/components/admin/seo-fields'
import { MediaGalleryPicker, MediaPicker } from '@/components/admin/media/media-picker'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { FormActionBar } from '@/components/admin/form-action-bar'
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

const WATER_POINT_TYPES = [
  'borehole',
  'shallow_well',
  'spring_protection',
  'rainwater_harvesting',
  'solar_pump',
  'rehabilitation',
  'piped_scheme',
] as const

export type ProjectFormValues = {
  id: string
  coverId: string | null
  status: 'planned' | 'in_progress' | 'completed'
  publishStatus: 'draft' | 'published' | 'archived'
  isFeatured: boolean
  waterPointType: (typeof WATER_POINT_TYPES)[number]
  country: string
  region: string
  district: string
  village: string
  latitude: string
  longitude: string
  wellsCount: string
  depthMeters: string
  yieldLitersPerHour: string
  waterQualityNote: string
  preWalkMinutes: string
  postWalkMinutes: string
  preQueueMinutes: string
  postQueueMinutes: string
  beneficiaries: string
  households: string
  schoolsServed: string
  healthFacilitiesServed: string
  startDate: string
  completionDate: string
  plannedCompletionDate: string
  budgetAmount: string
  fundedAmount: string
  currency: string
  galleryIds: string[]
  sortOrder: string
  translations: Partial<Record<Locale, Translation>>
}

export function ProjectForm({
  initial,
  currencies,
  storageEnabled,
}: {
  initial?: ProjectFormValues
  currencies: string[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tProjects = useTranslations('projects')
  const tBeforeAfter = useTranslations('beforeAfter.admin')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [values, setValues] = useState<Omit<ProjectFormValues, 'id' | 'translations'>>({
    coverId: initial?.coverId ?? null,
    status: initial?.status ?? 'planned',
    publishStatus: initial?.publishStatus ?? 'draft',
    isFeatured: initial?.isFeatured ?? false,
    waterPointType: initial?.waterPointType ?? 'borehole',
    country: initial?.country ?? 'Uganda',
    region: initial?.region ?? '',
    district: initial?.district ?? '',
    village: initial?.village ?? '',
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
    wellsCount: initial?.wellsCount ?? '1',
    depthMeters: initial?.depthMeters ?? '',
    yieldLitersPerHour: initial?.yieldLitersPerHour ?? '',
    waterQualityNote: initial?.waterQualityNote ?? '',
    preWalkMinutes: initial?.preWalkMinutes ?? '',
    postWalkMinutes: initial?.postWalkMinutes ?? '',
    preQueueMinutes: initial?.preQueueMinutes ?? '',
    postQueueMinutes: initial?.postQueueMinutes ?? '',
    beneficiaries: initial?.beneficiaries ?? '0',
    households: initial?.households ?? '',
    schoolsServed: initial?.schoolsServed ?? '',
    healthFacilitiesServed: initial?.healthFacilitiesServed ?? '',
    startDate: initial?.startDate ?? '',
    completionDate: initial?.completionDate ?? '',
    plannedCompletionDate: initial?.plannedCompletionDate ?? '',
    budgetAmount: initial?.budgetAmount ?? '',
    fundedAmount: initial?.fundedAmount ?? '0',
    currency: initial?.currency ?? currencies[0] ?? 'EUR',
    galleryIds: initial?.galleryIds ?? [],
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
      const numeric = (value: string) => (value.trim() === '' ? null : Number(value))

      const result = await saveProject({
        id: initial?.id,
        ...values,
        latitude: numeric(values.latitude),
        longitude: numeric(values.longitude),
        wellsCount: Number(values.wellsCount || 0),
        depthMeters: numeric(values.depthMeters),
        yieldLitersPerHour: numeric(values.yieldLitersPerHour),
        beneficiaries: Number(values.beneficiaries || 0),
        households: numeric(values.households),
        schoolsServed: numeric(values.schoolsServed),
        healthFacilitiesServed: numeric(values.healthFacilitiesServed),
        budgetAmount: numeric(values.budgetAmount),
        fundedAmount: Number(values.fundedAmount || 0),
        sortOrder: Number(values.sortOrder || 0),
        startDate: values.startDate || null,
        completionDate: values.completionDate || null,
        plannedCompletionDate: values.plannedCompletionDate || null,
        translations: Object.fromEntries(
          locales
            .filter((locale) => translations[locale].title.trim())
            .map((locale) => [locale, translations[locale]]),
        ),
      })

      if (result.ok) {
        toast.success(tCommon('success.saved'))
        router.push('/admin/projects')
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
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="pt-5">
            <LocaleFields isFilled={(locale) => Boolean(translations[locale].title.trim())}>
              {(locale) => (
                <>
                  <Field label={`${tProjects('title')} — ${locale}`} htmlFor={`p-title-${locale}`} required>
                    <Input
                      id={`p-title-${locale}`}
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

                  <Field label={t('slug')} htmlFor={`p-slug-${locale}`}>
                    <Input
                      id={`p-slug-${locale}`}
                      value={translations[locale].slug}
                      onChange={(event) => updateTranslation(locale, { slug: event.target.value })}
                    />
                  </Field>

                  <Field label={tProjects('subtitle')} htmlFor={`p-summary-${locale}`}>
                    <Textarea
                      id={`p-summary-${locale}`}
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

                  <SeoFields
                    idPrefix={`project-${locale}`}
                    title={translations[locale].seoTitle}
                    description={translations[locale].seoDescription}
                    fallbackTitle={translations[locale].title}
                    previewUrl={`${locale}/projects/${translations[locale].slug || '…'}`}
                    onChange={(patch) => updateTranslation(locale, patch)}
                  />
                </>
              )}
            </LocaleFields>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tProjects('facts.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={tProjects('filters.type')} htmlFor="waterPointType">
              <Select
                id="waterPointType"
                value={values.waterPointType}
                onChange={(event) => set('waterPointType', event.target.value as never)}
              >
                {WATER_POINT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {tProjects(`type.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={tProjects('facts.wells')} htmlFor="wellsCount">
              <Input
                id="wellsCount"
                type="number"
                min={0}
                value={values.wellsCount}
                onChange={(event) => set('wellsCount', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.depth')} htmlFor="depthMeters">
              <Input
                id="depthMeters"
                type="number"
                min={0}
                value={values.depthMeters}
                onChange={(event) => set('depthMeters', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.yield')} htmlFor="yieldLitersPerHour">
              <Input
                id="yieldLitersPerHour"
                type="number"
                min={0}
                value={values.yieldLitersPerHour}
                onChange={(event) => set('yieldLitersPerHour', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.beneficiaries')} htmlFor="beneficiaries">
              <Input
                id="beneficiaries"
                type="number"
                min={0}
                value={values.beneficiaries}
                onChange={(event) => set('beneficiaries', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.households')} htmlFor="households">
              <Input
                id="households"
                type="number"
                min={0}
                value={values.households}
                onChange={(event) => set('households', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.schools')} htmlFor="schoolsServed">
              <Input
                id="schoolsServed"
                type="number"
                min={0}
                value={values.schoolsServed}
                onChange={(event) => set('schoolsServed', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.healthFacilities')} htmlFor="healthFacilitiesServed">
              <Input
                id="healthFacilitiesServed"
                type="number"
                min={0}
                value={values.healthFacilitiesServed}
                onChange={(event) => set('healthFacilitiesServed', event.target.value)}
              />
            </Field>

            <Field label={tProjects('facts.quality')} htmlFor="waterQualityNote">
              <Input
                id="waterQualityNote"
                value={values.waterQualityNote}
                onChange={(event) => set('waterQualityNote', event.target.value)}
              />
            </Field>

            {/* Published as a before/after comparison, and only when both
                halves of a pair are filled in. */}
            {(
              [
                ['preWalkMinutes', 'preWalk'],
                ['postWalkMinutes', 'postWalk'],
                ['preQueueMinutes', 'preQueue'],
                ['postQueueMinutes', 'postQueue'],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} label={tBeforeAfter(label)} htmlFor={field}>
                <Input
                  id={field}
                  type="number"
                  min={0}
                  value={values[field]}
                  onChange={(event) => set(field, event.target.value)}
                />
              </Field>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tProjects('facts.location')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Country" htmlFor="country">
              <Input
                id="country"
                value={values.country}
                onChange={(event) => set('country', event.target.value)}
              />
            </Field>
            <Field label="Region" htmlFor="region">
              <Input
                id="region"
                value={values.region}
                onChange={(event) => set('region', event.target.value)}
              />
            </Field>
            <Field label={tProjects('filters.district')} htmlFor="district">
              <Input
                id="district"
                value={values.district}
                onChange={(event) => set('district', event.target.value)}
              />
            </Field>
            <Field label="Village" htmlFor="village">
              <Input
                id="village"
                value={values.village}
                onChange={(event) => set('village', event.target.value)}
              />
            </Field>
            <Field label="Latitude" htmlFor="latitude">
              <Input
                id="latitude"
                inputMode="decimal"
                value={values.latitude}
                onChange={(event) => set('latitude', event.target.value)}
              />
            </Field>
            <Field label="Longitude" htmlFor="longitude">
              <Input
                id="longitude"
                inputMode="decimal"
                value={values.longitude}
                onChange={(event) => set('longitude', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tProjects('facts.budget')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label={tProjects('facts.budget')} htmlFor="budgetAmount">
              <Input
                id="budgetAmount"
                inputMode="decimal"
                value={values.budgetAmount}
                onChange={(event) => set('budgetAmount', event.target.value)}
              />
            </Field>
            <Field label={tProjects('facts.funded')} htmlFor="fundedAmount">
              <Input
                id="fundedAmount"
                inputMode="decimal"
                value={values.fundedAmount}
                onChange={(event) => set('fundedAmount', event.target.value)}
              />
            </Field>
            <Field label="Currency" htmlFor="currency">
              <Select
                id="currency"
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
            <Field label={tProjects('facts.started')} htmlFor="startDate">
              <Input
                id="startDate"
                type="date"
                value={values.startDate}
                onChange={(event) => set('startDate', event.target.value)}
              />
            </Field>
            <Field label={tProjects('facts.completed')} htmlFor="completionDate">
              <Input
                id="completionDate"
                type="date"
                value={values.completionDate}
                onChange={(event) => set('completionDate', event.target.value)}
              />
            </Field>
            <Field label={tProjects('facts.plannedCompletion')} htmlFor="plannedCompletionDate">
              <Input
                id="plannedCompletionDate"
                type="date"
                value={values.plannedCompletionDate}
                onChange={(event) => set('plannedCompletionDate', event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('status')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label={tProjects('filters.status')} htmlFor="phase">
              <Select
                id="phase"
                value={values.status}
                onChange={(event) => set('status', event.target.value as never)}
              >
                <option value="planned">{tProjects('status.planned')}</option>
                <option value="in_progress">{tProjects('status.in_progress')}</option>
                <option value="completed">{tProjects('status.completed')}</option>
              </Select>
            </Field>

            <Field label={t('status')} htmlFor="publishStatus">
              <Select
                id="publishStatus"
                value={values.publishStatus}
                onChange={(event) => set('publishStatus', event.target.value as never)}
              >
                <option value="draft">{t('draft')}</option>
                <option value="published">{t('published')}</option>
                <option value="archived">{t('archived')}</option>
              </Select>
            </Field>

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
            <CardTitle className="text-base">{t('coverImage')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <MediaPicker
              value={values.coverId}
              onChange={(id) => set('coverId', id)}
              storageEnabled={storageEnabled}
            />
            <MediaGalleryPicker
              value={values.galleryIds}
              onChange={(ids) => set('galleryIds', ids)}
              storageEnabled={storageEnabled}
              label={t('gallery')}
            />
          </CardContent>
        </Card>
      </aside>

      <FormActionBar>
        <Select
          value={values.publishStatus}
          onChange={(event) => set('publishStatus', event.target.value as never)}
          aria-label={t('status')}
          className="flex-1"
        >
          <option value="draft">{t('draft')}</option>
          <option value="published">{t('published')}</option>
          <option value="archived">{t('archived')}</option>
        </Select>

        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {tCommon('save')}
        </Button>
      </FormActionBar>
    </form>
  )
}
