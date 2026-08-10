'use client'

import { Loader2, RotateCcw, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { resetTheme, saveTheme } from '@/app/actions/admin/appearance'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  defaultThemeTokens,
  themeToCss,
  type Palette,
  type ThemeTokens,
} from '@/lib/theme/tokens'

const PALETTE_KEYS: (keyof Palette)[] = [
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'muted',
  'mutedForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'border',
  'ring',
  'success',
  'warning',
  'danger',
]

const LABELS: Record<keyof Palette, string> = {
  background: 'Background',
  foreground: 'Text',
  surface: 'Surface',
  surfaceForeground: 'Surface text',
  muted: 'Muted',
  mutedForeground: 'Muted text',
  primary: 'Primary',
  primaryForeground: 'On primary',
  secondary: 'Secondary',
  secondaryForeground: 'On secondary',
  accent: 'Accent',
  accentForeground: 'On accent',
  border: 'Border',
  ring: 'Focus ring',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
}

/**
 * Edits the design tokens with a live preview. The preview scopes the same CSS
 * variables the site uses, so what is shown is exactly what will be published.
 */
export function ThemeEditor({ initial }: { initial: ThemeTokens }) {
  const t = useTranslations('admin.appearance')
  const tCommon = useTranslations('common')
  const [tokens, setTokens] = useState<ThemeTokens>(initial)
  const [pending, startTransition] = useTransition()

  const previewCss = useMemo(
    () => themeToCss(tokens).replace(/:root/g, '#theme-preview'),
    [tokens],
  )

  const setPalette = (mode: 'light' | 'dark', key: keyof Palette, value: string) =>
    setTokens((current) => ({
      ...current,
      colors: { ...current.colors, [mode]: { ...current.colors[mode], [key]: value } },
    }))

  // Only the object-valued sections are patched this way.
  type NestedSection = 'fonts' | 'typography' | 'spacing' | 'radius' | 'effects'

  const setNested = <S extends NestedSection>(section: S, patch: Partial<ThemeTokens[S]>) =>
    setTokens((current) => ({ ...current, [section]: { ...current[section], ...patch } }))

  function save() {
    startTransition(async () => {
      const result = await saveTheme(tokens)
      if (result.ok) toast.success(t('saved'))
      else toast.error(tCommon('error.generic'))
    })
  }

  function reset() {
    startTransition(async () => {
      const result = await resetTheme()
      if (result.ok) {
        setTokens(defaultThemeTokens)
        toast.success(tCommon('success.saved'))
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('colors')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="light">
              <TabsList>
                <TabsTrigger value="light">{t('light')}</TabsTrigger>
                <TabsTrigger value="dark">{t('dark')}</TabsTrigger>
              </TabsList>

              {(['light', 'dark'] as const).map((mode) => (
                <TabsContent key={mode} value={mode}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PALETTE_KEYS.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="color"
                          value={tokens.colors[mode][key]}
                          onChange={(event) => setPalette(mode, key, event.target.value)}
                          aria-label={LABELS[key]}
                          className="size-9 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border bg-transparent"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{LABELS[key]}</span>
                          <span className="font-mono text-[0.7rem] text-muted-foreground">
                            {tokens.colors[mode][key]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <Field label={t('colorScheme')} htmlFor="colorScheme" className="mt-5 max-w-xs">
              <Select
                id="colorScheme"
                value={tokens.colorScheme}
                onChange={(event) =>
                  setTokens({ ...tokens, colorScheme: event.target.value as ThemeTokens['colorScheme'] })
                }
              >
                <option value="system">system</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('typography')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fontSans')} htmlFor="fontSans">
              <Input
                id="fontSans"
                value={tokens.fonts.sans}
                onChange={(event) => setNested('fonts', { sans: event.target.value })}
              />
            </Field>
            <Field label={t('fontHeading')} htmlFor="fontHeading">
              <Input
                id="fontHeading"
                value={tokens.fonts.heading}
                onChange={(event) => setNested('fonts', { heading: event.target.value })}
              />
            </Field>

            <Range
              label={t('baseSize')}
              min={12}
              max={22}
              step={1}
              suffix="px"
              value={tokens.typography.baseSize}
              onChange={(baseSize) => setNested('typography', { baseSize })}
            />
            <Range
              label={t('scale')}
              min={1.05}
              max={1.5}
              step={0.01}
              value={tokens.typography.scale}
              onChange={(scale) => setNested('typography', { scale })}
            />
            <Range
              label={t('headingWeight')}
              min={400}
              max={900}
              step={50}
              value={tokens.typography.headingWeight}
              onChange={(headingWeight) => setNested('typography', { headingWeight })}
            />
            <Range
              label={t('bodyLineHeight')}
              min={1.2}
              max={2}
              step={0.05}
              value={tokens.typography.bodyLineHeight}
              onChange={(bodyLineHeight) => setNested('typography', { bodyLineHeight })}
            />
            <Range
              label={t('letterSpacing')}
              min={-0.05}
              max={0.05}
              step={0.005}
              suffix="em"
              value={tokens.typography.headingLetterSpacing}
              onChange={(headingLetterSpacing) => setNested('typography', { headingLetterSpacing })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('spacing')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Range
              label={t('spacingUnit')}
              min={0.125}
              max={0.5}
              step={0.005}
              suffix="rem"
              value={tokens.spacing.unit}
              onChange={(unit) => setNested('spacing', { unit })}
            />
            <Range
              label={t('gutter')}
              min={0.5}
              max={4}
              step={0.05}
              suffix="rem"
              value={tokens.spacing.gutter}
              onChange={(gutter) => setNested('spacing', { gutter })}
            />
            <Range
              label={t('containerWidth')}
              min={800}
              max={1920}
              step={20}
              suffix="px"
              value={tokens.spacing.containerMaxWidth}
              onChange={(containerMaxWidth) => setNested('spacing', { containerMaxWidth })}
            />
            <Range
              label={t('proseWidth')}
              min={480}
              max={1100}
              step={10}
              suffix="px"
              value={tokens.spacing.proseMaxWidth}
              onChange={(proseMaxWidth) => setNested('spacing', { proseMaxWidth })}
            />

            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">{t('sectionSpacing')}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {(['none', 'sm', 'md', 'lg', 'xl'] as const).map((key) => (
                  <Range
                    key={key}
                    label={key}
                    min={0}
                    max={key === 'xl' ? 32 : 24}
                    step={0.25}
                    suffix="rem"
                    value={tokens.spacing.sectionY[key]}
                    onChange={(value) =>
                      setNested('spacing', {
                        sectionY: { ...tokens.spacing.sectionY, [key]: value },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('effects')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Range
              label={t('radius')}
              min={0}
              max={2}
              step={0.05}
              suffix="rem"
              value={tokens.radius.base}
              onChange={(base) => setNested('radius', { base })}
            />
            <Range
              label={t('shadow')}
              min={0}
              max={1}
              step={0.05}
              value={tokens.effects.shadowStrength}
              onChange={(shadowStrength) => setNested('effects', { shadowStrength })}
            />
            <Range
              label={t('borderWidth')}
              min={0}
              max={3}
              step={0.5}
              suffix="px"
              value={tokens.effects.borderWidth}
              onChange={(borderWidth) => setNested('effects', { borderWidth })}
            />
          </CardContent>
        </Card>
      </div>

      <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-6">
        <div className="flex gap-2">
          <Button type="button" onClick={save} disabled={pending} className="flex-1">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {tCommon('save')}
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={pending}>
            <RotateCcw className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t('reset')}</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('livePreview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <style dangerouslySetInnerHTML={{ __html: previewCss }} />
            <div
              id="theme-preview"
              className="overflow-hidden rounded-[var(--radius-lg)] border"
              style={{
                background: 'var(--c-background)',
                color: 'var(--c-foreground)',
                borderColor: 'var(--c-border)',
                fontFamily: 'var(--f-sans)',
              }}
            >
              <div
                style={{
                  background: 'var(--c-secondary)',
                  color: 'var(--c-secondary-foreground)',
                  padding: 'var(--section-y-sm) var(--gutter)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--f-heading)',
                    fontWeight: 'var(--heading-weight)' as never,
                    letterSpacing: 'var(--heading-tracking)',
                    fontSize: 'var(--step-3)',
                    lineHeight: 1.15,
                  }}
                >
                  Clean water, documented
                </p>
                <p style={{ fontSize: 'var(--step-0)', opacity: 0.9, marginTop: '0.5rem' }}>
                  Every borehole with its drilling log and yield test.
                </p>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '1rem',
                    background: 'var(--c-primary)',
                    color: 'var(--c-primary-foreground)',
                    borderRadius: 'var(--r-base)',
                    padding: '0.6rem 1.1rem',
                    fontSize: 'var(--step-0)',
                  }}
                >
                  Donate
                </span>
              </div>

              <div style={{ padding: 'var(--section-y-sm) var(--gutter)' }}>
                <div
                  style={{
                    background: 'var(--c-surface)',
                    color: 'var(--c-surface-foreground)',
                    border: 'var(--border-width) solid var(--c-border)',
                    borderRadius: 'var(--r-lg)',
                    padding: '1rem',
                  }}
                >
                  <p style={{ fontSize: 'var(--step-1)', fontFamily: 'var(--f-heading)' }}>
                    Nadunget boreholes
                  </p>
                  <p
                    style={{
                      fontSize: 'var(--step--1)',
                      color: 'var(--c-muted-foreground)',
                      marginTop: '0.35rem',
                      lineHeight: 'var(--leading-body)',
                    }}
                  >
                    Three water points serving two schools and a health centre.
                  </p>
                  <div
                    style={{
                      marginTop: '0.75rem',
                      height: '0.5rem',
                      borderRadius: '999px',
                      background: 'var(--c-muted)',
                    }}
                  >
                    <div
                      style={{
                        width: '64%',
                        height: '100%',
                        borderRadius: '999px',
                        background: 'var(--c-accent)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function Range({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium capitalize">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {value}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--color-primary)]"
      />
    </div>
  )
}
