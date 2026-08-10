import { z } from 'zod'

/**
 * Design tokens edited from the admin "Appearance" section and rendered as CSS
 * custom properties on `:root`. Tailwind v4 maps its utilities onto these
 * variables (see `src/app/globals.css`), so a colour or spacing change takes
 * effect without a rebuild.
 */

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour such as #1d4ed8')

export const paletteSchema = z.object({
  background: hexColor,
  foreground: hexColor,
  surface: hexColor,
  surfaceForeground: hexColor,
  muted: hexColor,
  mutedForeground: hexColor,
  primary: hexColor,
  primaryForeground: hexColor,
  secondary: hexColor,
  secondaryForeground: hexColor,
  accent: hexColor,
  accentForeground: hexColor,
  border: hexColor,
  ring: hexColor,
  success: hexColor,
  warning: hexColor,
  danger: hexColor,
})

export const themeTokensSchema = z.object({
  colors: z.object({
    light: paletteSchema,
    dark: paletteSchema,
  }),
  /** `system` follows the visitor's OS preference. */
  colorScheme: z.enum(['light', 'dark', 'system']).default('system'),
  fonts: z.object({
    sans: z.string().trim().min(1),
    heading: z.string().trim().min(1),
  }),
  typography: z.object({
    /** Root font size in px; every rem-based size scales with it. */
    baseSize: z.number().min(12).max(22),
    /** Modular scale ratio used for heading sizes. */
    scale: z.number().min(1.05).max(1.5),
    headingWeight: z.number().int().min(400).max(900),
    bodyLineHeight: z.number().min(1.2).max(2),
    headingLetterSpacing: z.number().min(-0.05).max(0.05),
  }),
  radius: z.object({
    /** Base corner radius in rem; other radii derive from it. */
    base: z.number().min(0).max(2),
  }),
  spacing: z.object({
    /** Spacing unit in rem — drives Tailwind's spacing scale. */
    unit: z.number().min(0.125).max(0.5),
    /** Vertical rhythm presets used by page sections, in rem. */
    sectionY: z.object({
      none: z.number().min(0).max(12),
      sm: z.number().min(0).max(12),
      md: z.number().min(0).max(16),
      lg: z.number().min(0).max(24),
      xl: z.number().min(0).max(32),
    }),
    /** Horizontal page gutter in rem (mobile first). */
    gutter: z.number().min(0.5).max(4),
    /** Max content width in px. */
    containerMaxWidth: z.number().int().min(800).max(1920),
    /** Max width for prose columns in px. */
    proseMaxWidth: z.number().int().min(480).max(1100),
  }),
  effects: z.object({
    shadowStrength: z.number().min(0).max(1),
    borderWidth: z.number().min(0).max(3),
  }),
})

export type Palette = z.infer<typeof paletteSchema>
export type ThemeTokens = z.infer<typeof themeTokensSchema>

/** Warm, water-and-earth palette that suits a Ugandan drilling company. */
export const defaultThemeTokens: ThemeTokens = {
  colors: {
    light: {
      background: '#ffffff',
      foreground: '#0f1c26',
      surface: '#f6f9fb',
      surfaceForeground: '#0f1c26',
      muted: '#eef3f6',
      mutedForeground: '#5b6b78',
      primary: '#0a6d8f',
      primaryForeground: '#ffffff',
      secondary: '#0f3b4c',
      secondaryForeground: '#ffffff',
      accent: '#e2a13b',
      accentForeground: '#241703',
      border: '#dde5ea',
      ring: '#0a6d8f',
      success: '#1f9d63',
      warning: '#d98b16',
      danger: '#c8443a',
    },
    dark: {
      background: '#0a1219',
      foreground: '#e7eef3',
      surface: '#101c25',
      surfaceForeground: '#e7eef3',
      muted: '#16242e',
      mutedForeground: '#9aacb8',
      primary: '#39a8cc',
      primaryForeground: '#04141c',
      secondary: '#c9dbe4',
      secondaryForeground: '#0a1219',
      accent: '#e9b45c',
      accentForeground: '#1c1204',
      border: '#1f2f3a',
      ring: '#39a8cc',
      success: '#3fbe83',
      warning: '#e0a33c',
      danger: '#e06457',
    },
  },
  colorScheme: 'system',
  fonts: {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    heading: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  typography: {
    baseSize: 16,
    scale: 1.22,
    headingWeight: 700,
    bodyLineHeight: 1.65,
    headingLetterSpacing: -0.015,
  },
  radius: { base: 0.75 },
  spacing: {
    unit: 0.25,
    sectionY: { none: 0, sm: 2.5, md: 4, lg: 6, xl: 8 },
    gutter: 1.25,
    containerMaxWidth: 1200,
    proseMaxWidth: 720,
  },
  effects: { shadowStrength: 0.35, borderWidth: 1 },
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Keeps only the palette entries that are actually valid colours. */
function mergePalette(base: Palette, partial: Partial<Palette> | undefined): Palette {
  if (!partial) return base

  const merged = { ...base }
  for (const [key, value] of Object.entries(partial)) {
    if (typeof value === 'string' && HEX.test(value)) {
      merged[key as keyof Palette] = value
    }
  }
  return merged
}

/** Parses stored tokens, falling back to the defaults for anything invalid. */
export function parseThemeTokens(value: unknown): ThemeTokens {
  const result = themeTokensSchema.safeParse(value)
  if (result.success) return result.data

  // Merge field by field so a partially valid stored theme still contributes
  // without letting a malformed value reach the stylesheet.
  const partial = (value ?? {}) as Partial<ThemeTokens>
  return {
    ...defaultThemeTokens,
    ...partial,
    colors: {
      light: mergePalette(defaultThemeTokens.colors.light, partial.colors?.light),
      dark: mergePalette(defaultThemeTokens.colors.dark, partial.colors?.dark),
    },
    fonts: { ...defaultThemeTokens.fonts, ...partial.fonts },
    typography: { ...defaultThemeTokens.typography, ...partial.typography },
    radius: { ...defaultThemeTokens.radius, ...partial.radius },
    spacing: {
      ...defaultThemeTokens.spacing,
      ...partial.spacing,
      sectionY: { ...defaultThemeTokens.spacing.sectionY, ...partial.spacing?.sectionY },
    },
    effects: { ...defaultThemeTokens.effects, ...partial.effects },
  }
}

/**
 * Variables are prefixed with `--c-` / `--f-` / `--r-` because Tailwind maps
 * its own `--color-*`, `--font-*` and `--radius-*` namespaces onto them in
 * `globals.css`; reusing the same names would create circular references.
 */
const paletteVarNames: Record<keyof Palette, string> = {
  background: '--c-background',
  foreground: '--c-foreground',
  surface: '--c-surface',
  surfaceForeground: '--c-surface-foreground',
  muted: '--c-muted',
  mutedForeground: '--c-muted-foreground',
  primary: '--c-primary',
  primaryForeground: '--c-primary-foreground',
  secondary: '--c-secondary',
  secondaryForeground: '--c-secondary-foreground',
  accent: '--c-accent',
  accentForeground: '--c-accent-foreground',
  border: '--c-border',
  ring: '--c-ring',
  success: '--c-success',
  warning: '--c-warning',
  danger: '--c-danger',
}

function paletteVars(palette: Palette): string {
  return (Object.keys(paletteVarNames) as (keyof Palette)[])
    .map((key) => `${paletteVarNames[key]}: ${palette[key]};`)
    .join('')
}

/**
 * Serialises tokens into a stylesheet injected in `<head>`.
 * Dark colours are applied both via `prefers-color-scheme` and an explicit
 * `[data-theme="dark"]` attribute so a manual toggle wins in both directions.
 */
export function themeToCss(tokens: ThemeTokens): string {
  const { typography, spacing, radius, effects, fonts } = tokens

  const structural = [
    `--f-sans: ${fonts.sans};`,
    `--f-heading: ${fonts.heading};`,
    `--text-base-size: ${typography.baseSize}px;`,
    `--leading-body: ${typography.bodyLineHeight};`,
    `--heading-weight: ${typography.headingWeight};`,
    `--heading-tracking: ${typography.headingLetterSpacing}em;`,
    `--step--1: ${(1 / typography.scale).toFixed(3)}rem;`,
    `--step-0: 1rem;`,
    `--step-1: ${typography.scale.toFixed(3)}rem;`,
    `--step-2: ${Math.pow(typography.scale, 2).toFixed(3)}rem;`,
    `--step-3: ${Math.pow(typography.scale, 3).toFixed(3)}rem;`,
    `--step-4: ${Math.pow(typography.scale, 4).toFixed(3)}rem;`,
    `--step-5: ${Math.pow(typography.scale, 5).toFixed(3)}rem;`,
    `--space-unit: ${spacing.unit}rem;`,
    `--gutter: ${spacing.gutter}rem;`,
    `--container-max: ${spacing.containerMaxWidth}px;`,
    `--prose-max: ${spacing.proseMaxWidth}px;`,
    `--section-y-none: ${spacing.sectionY.none}rem;`,
    `--section-y-sm: ${spacing.sectionY.sm}rem;`,
    `--section-y-md: ${spacing.sectionY.md}rem;`,
    `--section-y-lg: ${spacing.sectionY.lg}rem;`,
    `--section-y-xl: ${spacing.sectionY.xl}rem;`,
    `--r-base: ${radius.base}rem;`,
    `--r-sm: ${(radius.base * 0.5).toFixed(3)}rem;`,
    `--r-lg: ${(radius.base * 1.5).toFixed(3)}rem;`,
    `--r-xl: ${(radius.base * 2).toFixed(3)}rem;`,
    `--border-width: ${effects.borderWidth}px;`,
    `--shadow-strength: ${effects.shadowStrength};`,
  ].join('')

  const light = paletteVars(tokens.colors.light)
  const dark = paletteVars(tokens.colors.dark)

  if (tokens.colorScheme === 'light') {
    return `:root{color-scheme:light;${structural}${light}}`
  }

  if (tokens.colorScheme === 'dark') {
    return `:root{color-scheme:dark;${structural}${dark}}`
  }

  return [
    `:root{color-scheme:light dark;${structural}${light}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}`,
    `:root[data-theme="dark"]{color-scheme:dark;${dark}}`,
    `:root[data-theme="light"]{color-scheme:light;${light}}`,
  ].join('')
}
