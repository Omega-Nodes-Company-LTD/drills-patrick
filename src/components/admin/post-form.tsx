'use client'

import { Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { savePost } from '@/app/actions/admin/content'
import { LocaleFields } from '@/components/admin/locale-fields'
import { SeoFields } from '@/components/admin/seo-fields'
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
  excerpt: string
  contentHtml: string
  seoTitle: string
  seoDescription: string
}

const emptyTranslation: Translation = {
  title: '',
  slug: '',
  excerpt: '',
  contentHtml: '',
  seoTitle: '',
  seoDescription: '',
}

export function PostForm({
  initial,
  categories,
  tags,
  authors,
  storageEnabled,
}: {
  initial?: {
    id: string
    coverId: string | null
    categoryId: string | null
    authorMemberId: string | null
    status: 'draft' | 'published' | 'archived'
    isFeatured: boolean
    tagIds: string[]
    translations: Partial<Record<Locale, Translation>>
  }
  categories: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  /** Published team members, the people who can carry a public byline. */
  authors: { id: string; name: string; credentials: string | null }[]
  storageEnabled: boolean
}) {
  const t = useTranslations('admin.common')
  const tPosts = useTranslations('admin.nav')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [coverId, setCoverId] = useState(initial?.coverId ?? null)
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [authorMemberId, setAuthorMemberId] = useState(initial?.authorMemberId ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'draft')
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false)
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? [])
  const [translations, setTranslations] = useState<Record<Locale, Translation>>(() =>
    Object.fromEntries(
      locales.map((locale) => [locale, initial?.translations[locale] ?? { ...emptyTranslation }]),
    ) as Record<Locale, Translation>,
  )

  function update(locale: Locale, patch: Partial<Translation>) {
    setTranslations((current) => ({ ...current, [locale]: { ...current[locale], ...patch } }))
  }

  function submit() {
    startTransition(async () => {
      const result = await savePost({
        id: initial?.id,
        coverId,
        categoryId: categoryId || null,
        authorMemberId: authorMemberId || null,
        status,
        isFeatured,
        tagIds,
        translations: Object.fromEntries(
          locales
            .filter((locale) => translations[locale].title.trim() || translations[locale].contentHtml.trim())
            .map((locale) => [locale, translations[locale]]),
        ),
      })

      if (result.ok) {
        toast.success(tCommon('success.saved'))
        router.push('/admin/posts')
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
                  <Field label={`${tPosts('posts')} — ${locale}`} htmlFor={`title-${locale}`} required>
                    <Input
                      id={`title-${locale}`}
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

                  <Field label={t('slug')} htmlFor={`slug-${locale}`}>
                    <Input
                      id={`slug-${locale}`}
                      value={translations[locale].slug}
                      onChange={(event) => update(locale, { slug: event.target.value })}
                    />
                  </Field>

                  <Field label={tCommon('readMore')} htmlFor={`excerpt-${locale}`}>
                    <Textarea
                      id={`excerpt-${locale}`}
                      rows={2}
                      value={translations[locale].excerpt}
                      onChange={(event) => update(locale, { excerpt: event.target.value })}
                    />
                  </Field>

                  <RichTextEditor
                    value={translations[locale].contentHtml}
                    onChange={(html) => update(locale, { contentHtml: html })}
                    storageEnabled={storageEnabled}
                  />

                  <SeoFields
                    idPrefix={`post-${locale}`}
                    title={translations[locale].seoTitle}
                    description={translations[locale].seoDescription}
                    fallbackTitle={translations[locale].title}
                    previewUrl={`${locale}/blog/${translations[locale].slug || '…'}`}
                    onChange={(patch) => update(locale, patch)}
                  />
                </>
              )}
            </LocaleFields>
          </CardContent>
        </Card>
      </div>

      <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('status')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              aria-label={t('status')}
            >
              <option value="draft">{t('draft')}</option>
              <option value="published">{t('published')}</option>
              <option value="archived">{t('archived')}</option>
            </Select>

            <label className="flex items-center justify-between gap-3 text-sm">
              {t('featured')}
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
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
          <CardContent>
            <MediaPicker value={coverId} onChange={setCoverId} storageEnabled={storageEnabled} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tPosts('categories')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label={tPosts('categories')}
            >
              <option value="">—</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>

            <Field label={t('author')} htmlFor="authorMemberId">
              <Select
                id="authorMemberId"
                value={authorMemberId}
                onChange={(event) => setAuthorMemberId(event.target.value)}
              >
                <option value="">—</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.credentials ? `${author.name} — ${author.credentials}` : author.name}
                  </option>
                ))}
              </Select>
            </Field>

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setTagIds(
                          active ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id],
                        )
                      }
                      className={
                        active
                          ? 'rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground'
                          : 'rounded-full border border-border px-2.5 py-1 text-xs'
                      }
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </form>
  )
}
