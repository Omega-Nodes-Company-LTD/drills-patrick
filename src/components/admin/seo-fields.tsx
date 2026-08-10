'use client'

import { useTranslations } from 'next-intl'
import { Field, Input, Textarea } from '@/components/ui/field'
import { cn } from '@/lib/utils'

/**
 * SEO title and description with a live result preview.
 *
 * An editor writing a meta description has no way of knowing it will be cut
 * in half, because the limit is not a character count — it is a pixel width
 * that only shows up once the page is live and indexed. Showing the result as
 * it will appear, with the counter next to it, turns that into something
 * visible while there is still time to fix it.
 *
 * The thresholds are Google's usual truncation points. They are advisory:
 * nothing is blocked, because a longer description is sometimes the right
 * call and the exact cut-off moves.
 */

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155

function Counter({ value, limit }: { value: string; limit: number }) {
  const length = value.trim().length
  const over = length > limit

  return (
    <span
      className={cn('tabular-nums', over ? 'text-warning' : 'text-muted-foreground')}
      title={over ? `Longer than ${limit} characters; likely to be truncated` : undefined}
    >
      {length}/{limit}
    </span>
  )
}

export function SeoFields({
  idPrefix,
  title,
  description,
  fallbackTitle,
  previewUrl,
  onChange,
}: {
  /** Unique per locale tab, so the labels keep pointing at the right input. */
  idPrefix: string
  title: string
  description: string
  /** Shown in the preview when no SEO title is set — the entity's own title. */
  fallbackTitle: string
  previewUrl: string
  onChange: (patch: { seoTitle?: string; seoDescription?: string }) => void
}) {
  const t = useTranslations('admin.common')

  const shownTitle = title.trim() || fallbackTitle.trim()
  const shownDescription = description.trim()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={
            <span className="flex items-baseline justify-between gap-2">
              {t('seoTitle')}
              <Counter value={shownTitle} limit={TITLE_LIMIT} />
            </span>
          }
          htmlFor={`${idPrefix}-seo-title`}
        >
          <Input
            id={`${idPrefix}-seo-title`}
            value={title}
            placeholder={fallbackTitle}
            onChange={(event) => onChange({ seoTitle: event.target.value })}
          />
        </Field>

        <Field
          label={
            <span className="flex items-baseline justify-between gap-2">
              {t('seoDescription')}
              <Counter value={description} limit={DESCRIPTION_LIMIT} />
            </span>
          }
          htmlFor={`${idPrefix}-seo-desc`}
        >
          <Textarea
            id={`${idPrefix}-seo-desc`}
            rows={2}
            value={description}
            onChange={(event) => onChange({ seoDescription: event.target.value })}
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-muted/40 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('serpPreview')}
        </p>

        <p className="truncate text-xs text-muted-foreground">{previewUrl}</p>
        <p className="truncate text-[1.05rem] leading-snug text-primary">
          {shownTitle || '—'}
        </p>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {shownDescription || t('serpNoDescription')}
        </p>
      </div>
    </div>
  )
}
