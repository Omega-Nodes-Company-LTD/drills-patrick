'use client'

import { ExternalLink, Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { savePage } from '@/app/actions/admin/content'
import { BlockEditor } from '@/components/admin/blocks/block-editor'
import { LocaleFields } from '@/components/admin/locale-fields'
import { SeoFields } from '@/components/admin/seo-fields'
import { FormActionBar } from '@/components/admin/form-action-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { locales, type Locale } from '@/i18n/config'
import { Link, useRouter } from '@/i18n/navigation'
import type { Block } from '@/lib/blocks/schema'
import { slugify } from '@/lib/utils'

type Translation = { title: string; slug: string; seoTitle: string; seoDescription: string }

const empty: Translation = { title: '', slug: '', seoTitle: '', seoDescription: '' }

export function PageForm({
  initial,
  storageEnabled,
  categories,
  campaigns,
}: {
  initial?: {
    id: string
    key: string
    status: 'draft' | 'published' | 'archived'
    showInSitemap: boolean
    isSystem: boolean
    blocks: Block[]
    translations: Partial<Record<Locale, Translation>>
  }
  storageEnabled: boolean
  categories: { id: string; name: string }[]
  campaigns: { id: string; title: string }[]
}) {
  const t = useTranslations('admin.common')
  const tBlocks = useTranslations('admin.blocks')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [key, setKey] = useState(initial?.key ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'draft')
  const [showInSitemap, setShowInSitemap] = useState(initial?.showInSitemap ?? true)
  const [blocks, setBlocks] = useState<Block[]>(initial?.blocks ?? [])
  const [translations, setTranslations] = useState<Record<Locale, Translation>>(() =>
    Object.fromEntries(
      locales.map((locale) => [locale, initial?.translations[locale] ?? { ...empty }]),
    ) as Record<Locale, Translation>,
  )

  function update(locale: Locale, patch: Partial<Translation>) {
    setTranslations((current) => ({ ...current, [locale]: { ...current[locale], ...patch } }))
  }

  function submit() {
    startTransition(async () => {
      const result = await savePage({
        id: initial?.id,
        key: key || slugify(translations.en.title) || 'page',
        status,
        showInSitemap,
        blocks,
        translations: Object.fromEntries(
          locales
            .filter((locale) => translations[locale].title.trim() || translations[locale].slug.trim())
            .map((locale) => [locale, translations[locale]]),
        ),
      })

      if (result.ok) {
        toast.success(tCommon('success.saved'))
        router.push('/admin/pages')
        router.refresh()
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  const previewSlug = translations.en.slug || translations.en.title

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardContent className="pt-5">
            <LocaleFields isFilled={(locale) => Boolean(translations[locale].title.trim())}>
              {(locale) => (
                <>
                  <Field label={`Title — ${locale}`} htmlFor={`pg-title-${locale}`} required>
                    <Input
                      id={`pg-title-${locale}`}
                      value={translations[locale].title}
                      onChange={(event) => {
                        const title = event.target.value
                        update(locale, {
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

                  <Field label={t('slug')} htmlFor={`pg-slug-${locale}`}>
                    <Input
                      id={`pg-slug-${locale}`}
                      value={translations[locale].slug}
                      onChange={(event) => update(locale, { slug: event.target.value })}
                    />
                  </Field>

                  <SeoFields
                    idPrefix={`page-${locale}`}
                    title={translations[locale].seoTitle}
                    description={translations[locale].seoDescription}
                    fallbackTitle={translations[locale].title}
                    previewUrl={`${locale}/${translations[locale].slug || '…'}`}
                    onChange={(patch) => update(locale, patch)}
                  />
                </>
              )}
            </LocaleFields>
          </CardContent>
        </Card>

        <aside className="flex h-fit flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('status')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* A system page has a route pointing at it, so it stays published. */}
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                aria-label={t('status')}
                disabled={initial?.isSystem}
              >
                <option value="draft">{t('draft')}</option>
                <option value="published">{t('published')}</option>
                <option value="archived">{t('archived')}</option>
              </Select>

              <Field label="Key" htmlFor="page-key" hint="home, about, contact…">
                <Input
                  id="page-key"
                  value={key}
                  onChange={(event) => setKey(slugify(event.target.value))}
                  disabled={initial?.isSystem}
                />
              </Field>

              <label className="flex items-center justify-between gap-3 text-sm">
                Sitemap
                <Switch checked={showInSitemap} onCheckedChange={setShowInSitemap} />
              </label>

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                {tCommon('save')}
              </Button>

              {initial && previewSlug ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={initial.key === 'home' ? '/' : `/${previewSlug}`} target="_blank">
                    <ExternalLink className="size-4" aria-hidden />
                    {tBlocks('preview')}
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading">{tBlocks('title')}</h2>
        <BlockEditor
          blocks={blocks}
          onChange={setBlocks}
          storageEnabled={storageEnabled}
          categories={categories}
          campaigns={campaigns}
        />
      </section>

      <FormActionBar>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label={t('status')}
          disabled={initial?.isSystem}
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
