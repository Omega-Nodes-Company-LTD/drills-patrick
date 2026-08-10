'use client'

import { CheckCircle2, Loader2, Save, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveSettings, testIntegration } from '@/app/actions/admin/settings'
import { I18nField } from '@/components/admin/blocks/i18n-field'
import { MediaPicker } from '@/components/admin/media/media-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { locales, localeLabels, type Locale } from '@/i18n/config'
import type { SiteSettings } from '@/lib/settings/service'

type Integration = { name: string; configured: boolean; testable?: 'storage' | 'embeddings' | 'mail' }

export function SettingsForm({
  initial,
  storageEnabled,
  integrations,
}: {
  initial: SiteSettings
  storageEnabled: boolean
  integrations: Integration[]
}) {
  const t = useTranslations('admin.settings')
  const tCommon = useTranslations('common')
  const tDash = useTranslations('admin.dashboard')
  const [values, setValues] = useState<SiteSettings>(initial)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  function submit() {
    startTransition(async () => {
      const result = await saveSettings(values)
      if (result.ok) toast.success(tCommon('success.saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Tabs defaultValue="general">
        <TabsList className="max-w-3xl">
          <TabsTrigger value="general">{t('general')}</TabsTrigger>
          <TabsTrigger value="contact">{t('contact')}</TabsTrigger>
          <TabsTrigger value="seo">{t('seo')}</TabsTrigger>
          <TabsTrigger value="donations">{t('donations')}</TabsTrigger>
          <TabsTrigger value="integrations">{t('integrations')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col gap-6">
          <Card>
            <CardContent className="grid gap-5 pt-5">
              <Field label={t('siteName')} htmlFor="siteName" required>
                <Input
                  id="siteName"
                  value={values.siteName}
                  onChange={(event) => set('siteName', event.target.value)}
                />
              </Field>

              <I18nField label={t('tagline')} value={values.tagline} onChange={(tagline) => set('tagline', tagline)} />
              <I18nField
                label={t('description')}
                variant="textarea"
                value={values.description}
                onChange={(description) => set('description', description)}
              />

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <MediaPicker
                  label={t('logoLight')}
                  value={values.logoLightId}
                  onChange={(id) => set('logoLightId', id)}
                  storageEnabled={storageEnabled}
                />
                <MediaPicker
                  label={t('logoDark')}
                  value={values.logoDarkId}
                  onChange={(id) => set('logoDarkId', id)}
                  storageEnabled={storageEnabled}
                />
                <MediaPicker
                  label={t('favicon')}
                  value={values.faviconId}
                  onChange={(id) => set('faviconId', id)}
                  storageEnabled={storageEnabled}
                />
                <MediaPicker
                  label={t('ogImage')}
                  value={values.ogImageId}
                  onChange={(id) => set('ogImageId', id)}
                  storageEnabled={storageEnabled}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('locales')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field label={t('defaultLocale')} htmlFor="defaultLocale" className="max-w-xs">
                <Select
                  id="defaultLocale"
                  value={values.defaultLocale}
                  onChange={(event) => set('defaultLocale', event.target.value as Locale)}
                >
                  {values.enabledLocales.map((locale) => (
                    <option key={locale} value={locale}>
                      {localeLabels[locale]}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('enabledLocales')}</span>
                {locales.map((locale) => (
                  <label key={locale} className="flex items-center justify-between gap-3 text-sm">
                    {localeLabels[locale]}
                    <Switch
                      checked={values.enabledLocales.includes(locale)}
                      onCheckedChange={(checked) =>
                        set(
                          'enabledLocales',
                          checked
                            ? [...values.enabledLocales, locale]
                            : values.enabledLocales.filter((entry) => entry !== locale),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('features')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(values.features) as (keyof SiteSettings['features'])[]).map((key) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm capitalize">
                  {key}
                  <Switch
                    checked={values.features[key]}
                    onCheckedChange={(checked) =>
                      set('features', { ...values.features, [key]: checked })
                    }
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="flex flex-col gap-6">
          <Card>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
              <Field label="Email" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  type="email"
                  value={values.contact.email ?? ''}
                  onChange={(event) =>
                    set('contact', { ...values.contact, email: event.target.value })
                  }
                />
              </Field>
              <Field label="Phone" htmlFor="contact-phone">
                <Input
                  id="contact-phone"
                  value={values.contact.phone ?? ''}
                  onChange={(event) =>
                    set('contact', { ...values.contact, phone: event.target.value })
                  }
                />
              </Field>
              <Field label="Address" htmlFor="contact-address" className="sm:col-span-2">
                <Input
                  id="contact-address"
                  value={values.contact.addressLines.join(', ')}
                  onChange={(event) =>
                    set('contact', {
                      ...values.contact,
                      addressLines: event.target.value
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="City" htmlFor="contact-city">
                <Input
                  id="contact-city"
                  value={values.contact.city ?? ''}
                  onChange={(event) => set('contact', { ...values.contact, city: event.target.value })}
                />
              </Field>
              <Field label="Country" htmlFor="contact-country">
                <Input
                  id="contact-country"
                  value={values.contact.country}
                  onChange={(event) =>
                    set('contact', { ...values.contact, country: event.target.value })
                  }
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('social')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'whatsapp'] as const).map(
                (key) => (
                  <Field key={key} label={key} htmlFor={`social-${key}`}>
                    <Input
                      id={`social-${key}`}
                      value={values.social[key] ?? ''}
                      onChange={(event) => set('social', { ...values.social, [key]: event.target.value })}
                    />
                  </Field>
                ),
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('organisation')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name" htmlFor="legalName">
                <Input
                  id="legalName"
                  value={values.organisation.legalName ?? ''}
                  onChange={(event) =>
                    set('organisation', { ...values.organisation, legalName: event.target.value })
                  }
                />
              </Field>
              <Field label="Registration number" htmlFor="registrationNumber">
                <Input
                  id="registrationNumber"
                  value={values.organisation.registrationNumber ?? ''}
                  onChange={(event) =>
                    set('organisation', {
                      ...values.organisation,
                      registrationNumber: event.target.value,
                    })
                  }
                />
              </Field>
              <Field
                label="Registry and directory pages"
                htmlFor="registryUrls"
                hint="One URL per line: the NGO board entry, a donor directory, a charity register. They are published as sameAs, which is how search and answer engines tie the site to a body that vouches for it."
                className="sm:col-span-2"
              >
                <Textarea
                  id="registryUrls"
                  rows={3}
                  value={(values.organisation.registryUrls ?? []).join('\n')}
                  onChange={(event) =>
                    set('organisation', {
                      ...values.organisation,
                      registryUrls: event.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardContent className="grid gap-5 pt-5">
              <I18nField
                label={t('siteName')}
                value={values.seo.metaTitle}
                onChange={(metaTitle) => set('seo', { ...values.seo, metaTitle })}
              />
              <I18nField
                label={t('description')}
                variant="textarea"
                value={values.seo.metaDescription}
                onChange={(metaDescription) => set('seo', { ...values.seo, metaDescription })}
              />
              <Field label="Keywords" htmlFor="keywords">
                <Input
                  id="keywords"
                  value={values.seo.keywords.join(', ')}
                  onChange={(event) =>
                    set('seo', {
                      ...values.seo,
                      keywords: event.target.value
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plausible domain" htmlFor="plausible">
                  <Input
                    id="plausible"
                    value={values.seo.plausibleDomain ?? ''}
                    onChange={(event) =>
                      set('seo', { ...values.seo, plausibleDomain: event.target.value })
                    }
                  />
                </Field>
                <Field label="Google site verification" htmlFor="gsv">
                  <Input
                    id="gsv"
                    value={values.seo.googleSiteVerification ?? ''}
                    onChange={(event) =>
                      set('seo', { ...values.seo, googleSiteVerification: event.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Content licence"
                  htmlFor="contentLicence"
                  hint="e.g. CC BY 4.0. Stated in llms.txt and on the open data endpoint. Left empty, reuse is declared as needing permission."
                >
                  <Input
                    id="contentLicence"
                    value={values.seo.contentLicence ?? ''}
                    onChange={(event) =>
                      set('seo', { ...values.seo, contentLicence: event.target.value })
                    }
                  />
                </Field>

                <Field label="Licence URL" htmlFor="contentLicenceUrl">
                  <Input
                    id="contentLicenceUrl"
                    type="url"
                    value={values.seo.contentLicenceUrl ?? ''}
                    onChange={(event) =>
                      set('seo', { ...values.seo, contentLicenceUrl: event.target.value })
                    }
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="donations" className="flex flex-col gap-6">
          <Card>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
              <Field label={t('defaultCurrency')} htmlFor="defaultCurrency">
                <Select
                  id="defaultCurrency"
                  value={values.donations.defaultCurrency}
                  onChange={(event) =>
                    set('donations', { ...values.donations, defaultCurrency: event.target.value })
                  }
                >
                  {values.donations.currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('currencies')} htmlFor="currencies" hint="EUR, USD, UGX">
                <Input
                  id="currencies"
                  value={values.donations.currencies.join(', ')}
                  onChange={(event) =>
                    set('donations', {
                      ...values.donations,
                      currencies: event.target.value
                        .split(',')
                        .map((entry) => entry.trim().toUpperCase())
                        .filter((entry) => entry.length === 3),
                    })
                  }
                />
              </Field>

              <Field label={t('receiptPrefix')} htmlFor="receiptPrefix">
                <Input
                  id="receiptPrefix"
                  value={values.donations.receiptPrefix}
                  onChange={(event) =>
                    set('donations', { ...values.donations, receiptPrefix: event.target.value })
                  }
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('bankTransfer')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['accountName', 'Account name'],
                  ['bankName', 'Bank'],
                  ['accountNumber', 'Account number'],
                  ['iban', 'IBAN'],
                  ['swift', 'SWIFT'],
                  ['branch', 'Branch'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`bank-${key}`}>
                  <Input
                    id={`bank-${key}`}
                    value={values.bankTransfer[key] ?? ''}
                    onChange={(event) =>
                      set('bankTransfer', { ...values.bankTransfer, [key]: event.target.value })
                    }
                  />
                </Field>
              ))}

              <div className="sm:col-span-2">
                <I18nField
                  label="Instructions"
                  variant="rich"
                  storageEnabled={storageEnabled}
                  value={values.bankTransfer.instructions}
                  onChange={(instructions) =>
                    set('bankTransfer', { ...values.bankTransfer, instructions })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('integrations')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t('integrationsHint')}</p>

              <ul className="flex flex-col divide-y divide-border">
                {integrations.map((integration) => (
                  <li key={integration.name} className="flex items-center gap-3 py-2.5 text-sm">
                    {integration.configured ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="capitalize">{integration.name}</span>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {integration.configured ? tDash('configured') : tDash('notConfigured')}
                    </span>
                    {integration.testable && integration.configured ? (
                      <TestButton target={integration.testable} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {tCommon('save')}
      </Button>
    </form>
  )
}

function TestButton({ target }: { target: 'storage' | 'embeddings' | 'mail' }) {
  const t = useTranslations('admin.settings')
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await testIntegration(target)
          if (result.ok) toast.success(t('connectionOk'))
          else toast.error(t('connectionFailed', { error: result.error ?? '' }))
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {t('testConnection')}
    </Button>
  )
}
