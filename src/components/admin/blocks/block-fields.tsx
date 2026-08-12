'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { MediaGalleryPicker, MediaPicker } from '@/components/admin/media/media-picker'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import type { Block } from '@/lib/blocks/schema'
import { createId } from '@/lib/utils'
import { pickI18n } from '@/i18n/config'
import { I18nField } from './i18n-field'

/**
 * Per-kind field editors. Every block gets exactly the controls it needs; the
 * shared spacing/background controls live in the wrapper.
 */
export function BlockFields({
  block,
  onChange,
  storageEnabled,
  categories,
  campaigns,
}: {
  block: Block
  onChange: (block: Block) => void
  storageEnabled: boolean
  categories: { id: string; name: string }[]
  campaigns: { id: string; title: string }[]
}) {
  const t = useTranslations('admin.blocks')
  const tCommon = useTranslations('common')

  const patch = (values: Partial<Block>) => onChange({ ...block, ...values } as Block)

  switch (block.kind) {
    case 'hero':
      return (
        <>
          <I18nField label="Eyebrow" value={block.eyebrow} onChange={(eyebrow) => patch({ eyebrow })} />
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <MediaPicker
            label={tCommon('open')}
            value={block.mediaId ?? null}
            onChange={(mediaId) => patch({ mediaId })}
            storageEnabled={storageEnabled}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Height" htmlFor={`height-${block.id}`}>
              <Select
                id={`height-${block.id}`}
                value={block.height}
                onChange={(event) => patch({ height: event.target.value as never })}
              >
                {['sm', 'md', 'lg', 'screen'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Align" htmlFor={`align-${block.id}`}>
              <Select
                id={`align-${block.id}`}
                value={block.align}
                onChange={(event) => patch({ align: event.target.value as never })}
              >
                <option value="left">left</option>
                <option value="center">center</option>
              </Select>
            </Field>
            <Field label="Overlay" htmlFor={`overlay-${block.id}`}>
              <Input
                id={`overlay-${block.id}`}
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={block.overlayOpacity}
                onChange={(event) => patch({ overlayOpacity: Number(event.target.value) })}
              />
            </Field>
          </div>

          <RepeatableList
            label="Call to action"
            items={block.ctas}
            onChange={(ctas) => patch({ ctas })}
            create={() => ({ label: {}, href: '/', variant: 'primary' as const })}
            render={(cta, update) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
                <I18nField label="Label" value={cta.label} onChange={(label) => update({ label })} />
                <Field label="URL">
                  <Input value={cta.href} onChange={(event) => update({ href: event.target.value })} />
                </Field>
                <Field label="Style">
                  <Select
                    value={cta.variant}
                    onChange={(event) => update({ variant: event.target.value as never })}
                  >
                    {['primary', 'secondary', 'outline', 'ghost'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          />

          <RepeatableList
            label="Highlights"
            items={block.highlights}
            onChange={(highlights) => patch({ highlights })}
            create={() => ({ value: '', label: {} })}
            render={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <Field label="Value">
                  <Input value={item.value} onChange={(event) => update({ value: event.target.value })} />
                </Field>
                <I18nField label="Label" value={item.label} onChange={(label) => update({ label })} />
              </div>
            )}
          />
        </>
      )

    case 'richText':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Content"
            variant="rich"
            storageEnabled={storageEnabled}
            value={block.content}
            onChange={(content) => patch({ content })}
          />
        </>
      )

    case 'stats':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <RepeatableList
            label="Figures"
            items={block.items}
            onChange={(items) => patch({ items })}
            create={() => ({ value: '', suffix: '', label: {} })}
            render={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-[8rem_6rem_1fr]">
                <Field label="Value">
                  <Input value={item.value} onChange={(event) => update({ value: event.target.value })} />
                </Field>
                <Field label="Suffix">
                  <Input
                    value={item.suffix ?? ''}
                    onChange={(event) => update({ suffix: event.target.value })}
                  />
                </Field>
                <I18nField label="Label" value={item.label} onChange={(label) => update({ label })} />
              </div>
            )}
          />
        </>
      )

    case 'steps':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <RepeatableList
            label="Steps"
            items={block.items}
            onChange={(items) => patch({ items })}
            create={() => ({ title: {}, text: {} })}
            render={(item, update) => (
              <div className="grid gap-3">
                <I18nField label="Title" value={item.title} onChange={(title) => update({ title })} />
                <I18nField
                  label="Text"
                  variant="textarea"
                  value={item.text}
                  onChange={(text) => update({ text })}
                />
              </div>
            )}
          />
        </>
      )

    case 'cta':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Text"
            variant="textarea"
            value={block.text}
            onChange={(text) => patch({ text })}
          />
          <MediaPicker
            value={block.mediaId ?? null}
            onChange={(mediaId) => patch({ mediaId })}
            storageEnabled={storageEnabled}
          />
          <RepeatableList
            label="Buttons"
            items={block.ctas}
            onChange={(ctas) => patch({ ctas })}
            create={() => ({ label: {}, href: '/', variant: 'primary' as const })}
            render={(cta, update) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
                <I18nField label="Label" value={cta.label} onChange={(label) => update({ label })} />
                <Field label="URL">
                  <Input value={cta.href} onChange={(event) => update({ href: event.target.value })} />
                </Field>
                <Field label="Style">
                  <Select
                    value={cta.variant}
                    onChange={(event) => update({ variant: event.target.value as never })}
                  >
                    {['primary', 'secondary', 'outline', 'ghost'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
          />
        </>
      )

    case 'projects':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <Select
                value={block.status}
                onChange={(event) => patch({ status: event.target.value as never })}
              >
                {['all', 'planned', 'in_progress', 'completed'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Limit">
              <Input
                type="number"
                min={1}
                max={12}
                value={block.limit}
                onChange={(event) => patch({ limit: Number(event.target.value) })}
              />
            </Field>
            <label className="flex items-center justify-between gap-2 self-end text-sm">
              Featured only
              <Switch
                checked={block.featuredOnly}
                onCheckedChange={(featuredOnly) => patch({ featuredOnly })}
              />
            </label>
          </div>
        </>
      )

    case 'posts':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={block.categoryId ?? ''}
                onChange={(event) => patch({ categoryId: event.target.value || null })}
              >
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Limit">
              <Input
                type="number"
                min={1}
                max={12}
                value={block.limit}
                onChange={(event) => patch({ limit: Number(event.target.value) })}
              />
            </Field>
          </div>
        </>
      )

    case 'campaigns':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Limit">
              <Input
                type="number"
                min={1}
                max={6}
                value={block.limit}
                onChange={(event) => patch({ limit: Number(event.target.value) })}
              />
            </Field>
            <label className="flex items-center justify-between gap-2 self-end text-sm">
              Active only
              <Switch checked={block.activeOnly} onCheckedChange={(activeOnly) => patch({ activeOnly })} />
            </label>
          </div>
        </>
      )

    case 'donate':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <Field label="Campaign">
            <Select
              value={block.campaignId ?? ''}
              onChange={(event) => patch({ campaignId: event.target.value || null })}
            >
              <option value="">—</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )

    case 'gallery':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <MediaGalleryPicker
            value={block.mediaIds}
            onChange={(mediaIds) => patch({ mediaIds })}
            storageEnabled={storageEnabled}
            label={t('kinds.gallery')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Columns">
              <Input
                type="number"
                min={2}
                max={4}
                value={block.columns}
                onChange={(event) => patch({ columns: Number(event.target.value) })}
              />
            </Field>
            <Field label="Aspect">
              <Select
                value={block.aspect}
                onChange={(event) => patch({ aspect: event.target.value as never })}
              >
                {['landscape', 'square', 'portrait'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      )

    case 'team':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <p className="text-small text-muted-foreground">
            Everyone published under Team appears here, in the order set on that screen. Edit a
            person once and they stay right on this page, on the team page, on their article
            bylines and on the capability statement.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Columns">
              <Input
                type="number"
                min={2}
                max={4}
                value={block.columns}
                onChange={(event) => patch({ columns: Number(event.target.value) })}
              />
            </Field>
            <label className="flex items-center justify-between gap-2 self-end text-sm">
              Show qualifications
              <Switch
                checked={block.showCredentials}
                onCheckedChange={(showCredentials) => patch({ showCredentials })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Show biography
              <Switch checked={block.showBio} onCheckedChange={(showBio) => patch({ showBio })} />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Show email and LinkedIn
              <Switch
                checked={block.showContact}
                onCheckedChange={(showContact) => patch({ showContact })}
              />
            </label>
          </div>
        </>
      )

    case 'video':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <Field label="URL" hint="YouTube or Vimeo">
            <Input value={block.url} onChange={(event) => patch({ url: event.target.value })} />
          </Field>
          <I18nField
            label="Caption"
            value={block.caption}
            onChange={(caption) => patch({ caption })}
          />
        </>
      )

    case 'map':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Latitude">
              <Input
                inputMode="decimal"
                value={block.center.lat}
                onChange={(event) =>
                  patch({ center: { ...block.center, lat: Number(event.target.value) } })
                }
              />
            </Field>
            <Field label="Longitude">
              <Input
                inputMode="decimal"
                value={block.center.lng}
                onChange={(event) =>
                  patch({ center: { ...block.center, lng: Number(event.target.value) } })
                }
              />
            </Field>
            <Field label="Zoom">
              <Input
                type="number"
                min={3}
                max={14}
                value={block.zoom}
                onChange={(event) => patch({ zoom: Number(event.target.value) })}
              />
            </Field>
          </div>
        </>
      )

    case 'contact':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Subtitle"
            variant="textarea"
            value={block.subtitle}
            onChange={(subtitle) => patch({ subtitle })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Form">
              <Select
                value={block.variant}
                onChange={(event) => patch({ variant: event.target.value as never })}
              >
                <option value="ngo">NGO quote request</option>
                <option value="general">General contact</option>
              </Select>
            </Field>
            <label className="flex items-center justify-between gap-2 self-end text-sm">
              Show contact details
              <Switch
                checked={block.showDetails}
                onCheckedChange={(showDetails) => patch({ showDetails })}
              />
            </label>
          </div>
        </>
      )

    case 'answer':
      return (
        <>
          <I18nField
            label="Question"
            value={block.question}
            onChange={(question) => patch({ question })}
          />
          <I18nField
            label="Answer"
            variant="textarea"
            value={block.answer}
            onChange={(answer) => patch({ answer })}
          />
          <p className="text-xs text-muted-foreground">
            Two or three factual sentences. This is the passage an assistant will
            quote, so keep it self-contained.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Verified on">
              <Input
                type="date"
                value={block.verifiedOn ?? ''}
                onChange={(event) => patch({ verifiedOn: event.target.value })}
              />
            </Field>
            <Field label="Source label">
              <Input
                value={block.sourceLabel ?? ''}
                onChange={(event) => patch({ sourceLabel: event.target.value })}
              />
            </Field>
            <Field label="Source URL">
              <Input
                type="url"
                value={block.sourceUrl ?? ''}
                onChange={(event) => patch({ sourceUrl: event.target.value })}
              />
            </Field>
          </div>
        </>
      )

    case 'table':
      return (
        <>
          <I18nField label="Title" value={block.title} onChange={(title) => patch({ title })} />
          <I18nField
            label="Caption"
            variant="textarea"
            value={block.caption}
            onChange={(caption) => patch({ caption })}
          />
          <I18nField
            label="Units"
            value={block.unitNote}
            onChange={(unitNote) => patch({ unitNote })}
          />

          <RepeatableList
            label="Columns"
            items={block.columns}
            create={() => ({})}
            onChange={(columns) =>
              patch({
                columns,
                // Rows follow the column count, so a removed column does not
                // leave orphan cells behind.
                rows: block.rows.map((row) => row.slice(0, columns.length)),
              })
            }
            render={(column, update) => (
              <I18nField label="Heading" value={column} onChange={(value) => update(value)} />
            )}
          />

          <RepeatableList
            label="Rows"
            items={block.rows}
            create={() => block.columns.map(() => ({}))}
            onChange={(rows) => patch({ rows })}
            render={(row, update) => (
              <div className="flex flex-col gap-2">
                {block.columns.map((column, index) => (
                  <I18nField
                    key={index}
                    label={pickI18n(column, 'en') || `Column ${index + 1}`}
                    value={row[index]}
                    onChange={(value) => {
                      const next = [...row]
                      next[index] = value
                      update(next as never)
                    }}
                  />
                ))}
              </div>
            )}
          />
        </>
      )

    // partners / testimonials / faq render everything published by default.
    default:
      return (
        <>
          <I18nField
            label="Title"
            value={'title' in block ? block.title : undefined}
            onChange={(title) => patch({ title } as Partial<Block>)}
          />
          <p className="text-xs text-muted-foreground">{t('preview')}</p>
        </>
      )
  }
}

/** Generic add/remove list used by the repeatable parts of several blocks. */
function RepeatableList<T>({
  label,
  items,
  onChange,
  create,
  render,
}: {
  label: string
  items: T[]
  onChange: (items: T[]) => void
  create: () => T
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode
}) {
  const tCommon = useTranslations('common')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, create()])}>
          <Plus className="size-3.5" aria-hidden />
          {tCommon('create')}
        </Button>
      </div>

      {items.map((item, index) => (
        <div key={index} className="rounded-[var(--radius-md)] border border-border p-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => onChange(items.filter((_, position) => position !== index))}
              className="text-muted-foreground hover:text-danger"
              aria-label={tCommon('delete')}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          {render(item, (patch) =>
            onChange(items.map((entry, position) => (position === index ? { ...entry, ...patch } : entry))),
          )}
        </div>
      ))}
    </div>
  )
}

/** Default value for a newly added block of a given kind. */
export function createBlock(kind: Block['kind']): Block {
  const base = {
    id: createId(),
    enabled: true,
    layout: {
      paddingTop: 'lg' as const,
      paddingBottom: 'lg' as const,
      width: 'container' as const,
      tone: 'default' as const,
    },
  }

  switch (kind) {
    case 'hero':
      return {
        ...base,
        kind,
        title: {},
        overlayOpacity: 0.45,
        height: 'lg',
        align: 'left',
        ctas: [],
        highlights: [],
      }
    case 'richText':
      return { ...base, kind, content: {} }
    case 'stats':
      return { ...base, kind, items: [] }
    case 'steps':
      return { ...base, kind, items: [] }
    case 'cta':
      return { ...base, kind, title: {}, ctas: [] }
    case 'projects':
      return { ...base, kind, status: 'all', limit: 3, featuredOnly: false }
    case 'posts':
      return { ...base, kind, limit: 3, categoryId: null }
    case 'campaigns':
      return { ...base, kind, limit: 2, activeOnly: true }
    case 'donate':
      return { ...base, kind, suggestedAmounts: [], campaignId: null }
    case 'gallery':
      return { ...base, kind, mediaIds: [], columns: 3, aspect: 'landscape' }
    case 'partners':
      return { ...base, kind, partnerIds: [] }
    case 'testimonials':
      return { ...base, kind, testimonialIds: [] }
    case 'team':
      return {
        ...base,
        kind,
        memberIds: [],
        columns: 3,
        showBio: true,
        showCredentials: true,
        showContact: true,
      }
    case 'faq':
      return { ...base, kind, faqIds: [] }
    case 'map':
      return {
        ...base,
        kind,
        zoom: 7,
        center: { lat: 1.3733, lng: 32.2903 },
        statuses: ['planned', 'in_progress', 'completed'],
      }
    case 'video':
      return { ...base, kind, url: '' }
    case 'contact':
      return { ...base, kind, variant: 'ngo', showDetails: true }
    case 'answer':
      return { ...base, kind, question: {}, answer: {} }
    case 'table':
      return { ...base, kind, columns: [], rows: [] }
  }
}
