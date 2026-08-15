'use client'

import {
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  MoveDown,
  MoveUp,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { blockKinds, type Block, type BlockLayout } from '@/lib/blocks/schema'
import { cn, createId } from '@/lib/utils'
import { BlockFields, createBlock } from './block-fields'

const SPACING = ['none', 'sm', 'md', 'lg', 'xl'] as const
const WIDTHS = ['narrow', 'container', 'wide', 'full'] as const
const TONES = ['default', 'surface', 'muted', 'primary', 'secondary', 'accent'] as const

/**
 * Section editor for pages: add, reorder, hide, duplicate and configure each
 * block, including its own spacing and background. Reordering uses explicit
 * buttons rather than drag-and-drop so it stays usable on a phone and with a
 * keyboard.
 */
export function BlockEditor({
  blocks,
  onChange,
  storageEnabled,
  categories,
  campaigns,
}: {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  storageEnabled: boolean
  categories: { id: string; name: string }[]
  campaigns: { id: string; title: string }[]
}) {
  const t = useTranslations('admin.blocks')
  const tCommon = useTranslations('common')
  const [openId, setOpenId] = useState<string | null>(blocks[0]?.id ?? null)
  const [adding, setAdding] = useState(false)

  const replace = (index: number, block: Block) =>
    onChange(blocks.map((entry, position) => (position === index ? block : entry)))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return

    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onChange(next)
  }

  const duplicate = (index: number) => {
    const source = blocks[index]!
    const copy = { ...structuredClone(source), id: createId() }
    const next = [...blocks]
    next.splice(index + 1, 0, copy)
    onChange(next)
    setOpenId(copy.id)
  }

  const patchLayout = (index: number, patch: Partial<BlockLayout>) => {
    const block = blocks[index]!
    replace(index, { ...block, layout: { ...block.layout, ...patch } } as Block)
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : null}

      {blocks.map((block, index) => {
        const open = openId === block.id

        return (
          <section
            key={block.id}
            className={cn(
              'overflow-hidden rounded-[var(--radius-lg)] border bg-surface',
              block.enabled ? 'border-border' : 'border-dashed border-border opacity-70',
            )}
          >
            <header className="flex flex-wrap items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : block.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
              >
                <ChevronDown
                  className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium">{t(`kinds.${block.kind}`)}</span>
                {!block.enabled ? (
                  <span className="text-xs text-muted-foreground">({t('hidden')})</span>
                ) : null}
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  label={block.enabled ? t('hidden') : tCommon('open')}
                  onClick={() => replace(index, { ...block, enabled: !block.enabled } as Block)}
                >
                  {block.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </IconButton>
                <IconButton label={t('moveUp')} onClick={() => move(index, -1)} disabled={index === 0}>
                  <MoveUp className="size-4" />
                </IconButton>
                <IconButton
                  label={t('moveDown')}
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                >
                  <MoveDown className="size-4" />
                </IconButton>
                <IconButton label={t('duplicate')} onClick={() => duplicate(index)}>
                  <Copy className="size-4" />
                </IconButton>
                <IconButton
                  label={t('remove')}
                  onClick={() => onChange(blocks.filter((_, position) => position !== index))}
                  danger
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </header>

            {open ? (
              <div className="flex flex-col gap-5 border-t border-border p-4">
                <BlockFields
                  block={block}
                  onChange={(next) => replace(index, next)}
                  storageEnabled={storageEnabled}
                  categories={categories}
                  campaigns={campaigns}
                />

                <fieldset className="grid gap-3 rounded-[var(--radius-md)] border border-border p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('layout')}
                  </legend>

                  <Field label={t('paddingTop')}>
                    <Select
                      value={block.layout.paddingTop}
                      onChange={(event) => patchLayout(index, { paddingTop: event.target.value as never })}
                    >
                      {SPACING.map((value) => (
                        <option key={value} value={value}>
                          {t(`spacing.${value}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('paddingBottom')}>
                    <Select
                      value={block.layout.paddingBottom}
                      onChange={(event) =>
                        patchLayout(index, { paddingBottom: event.target.value as never })
                      }
                    >
                      {SPACING.map((value) => (
                        <option key={value} value={value}>
                          {t(`spacing.${value}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('width')}>
                    <Select
                      value={block.layout.width}
                      onChange={(event) => patchLayout(index, { width: event.target.value as never })}
                    >
                      {WIDTHS.map((value) => (
                        <option key={value} value={value}>
                          {t(`widths.${value}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('tone')}>
                    <Select
                      value={block.layout.tone}
                      onChange={(event) => patchLayout(index, { tone: event.target.value as never })}
                    >
                      {TONES.map((value) => (
                        <option key={value} value={value}>
                          {t(`tones.${value}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('anchor')}>
                    <Input
                      value={block.layout.anchor ?? ''}
                      onChange={(event) => patchLayout(index, { anchor: event.target.value })}
                    />
                  </Field>
                </fieldset>
              </div>
            ) : null}
          </section>
        )
      })}

      {adding ? (
        <div className="rounded-[var(--radius-lg)] border border-border p-4">
          <p className="mb-3 text-sm font-medium">{t('add')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {blockKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const block = createBlock(kind)
                  onChange([...blocks, block])
                  setOpenId(block.id)
                  setAdding(false)
                }}
                className="rounded-[var(--radius-sm)] border border-border px-3 py-2 text-sm transition-colors hover:border-primary hover:bg-muted"
              >
                {t(`kinds.${kind}`)}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" className="mt-3" onClick={() => setAdding(false)}>
            {tCommon('cancel')}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)} className="self-start">
          <Plus className="size-4" aria-hidden />
          {t('add')}
        </Button>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        // Same reasoning as the editor toolbar: a `gap-0.5` cluster grows its
        // buttons on touch rather than overlapping invisible hit areas.
        'grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors pointer-coarse:size-11 hover:bg-muted disabled:opacity-30',
        danger && 'hover:text-danger',
      )}
    >
      {children}
    </button>
  )
}
