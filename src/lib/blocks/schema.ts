import { z } from 'zod'
import { i18nRichTextSchema, i18nTextSchema } from '@/i18n/schema'

/**
 * Page building blocks.
 *
 * A page stores its blocks once (structure is shared across languages) and the
 * textual leaves are i18n objects, so an editor arranges a layout a single time
 * and then only translates the copy.
 *
 * Every block carries `layout` props, which is how the admin can override
 * spacing and background per section rather than only globally.
 */

export const sectionSpacingSchema = z.enum(['none', 'sm', 'md', 'lg', 'xl'])
export const sectionWidthSchema = z.enum(['narrow', 'container', 'wide', 'full'])
export const sectionToneSchema = z.enum([
  'default',
  'surface',
  'muted',
  'primary',
  'secondary',
  'accent',
])

export const blockLayoutSchema = z.object({
  paddingTop: sectionSpacingSchema.default('lg'),
  paddingBottom: sectionSpacingSchema.default('lg'),
  width: sectionWidthSchema.default('container'),
  tone: sectionToneSchema.default('default'),
  /** Optional custom background colour that overrides `tone`. */
  background: z.string().optional(),
  /** Anchor id, used by in-page navigation links. */
  anchor: z.string().optional(),
})

export type BlockLayout = z.infer<typeof blockLayoutSchema>

const ctaSchema = z.object({
  label: i18nTextSchema,
  href: z.string(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).default('primary'),
})

const baseFields = {
  id: z.string(),
  enabled: z.boolean().default(true),
  layout: blockLayoutSchema,
}

export const heroBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('hero'),
  eyebrow: i18nTextSchema.optional(),
  title: i18nTextSchema,
  subtitle: i18nTextSchema.optional(),
  mediaId: z.string().uuid().nullish(),
  overlayOpacity: z.number().min(0).max(1).default(0.45),
  height: z.enum(['sm', 'md', 'lg', 'screen']).default('lg'),
  align: z.enum(['left', 'center']).default('left'),
  ctas: z.array(ctaSchema).max(2).default([]),
  /** Small trust indicators rendered under the CTAs. */
  highlights: z
    .array(z.object({ value: z.string(), label: i18nTextSchema }))
    .max(4)
    .default([]),
})

export const richTextBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('richText'),
  title: i18nTextSchema.optional(),
  content: i18nRichTextSchema,
})

export const statsBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('stats'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  items: z
    .array(
      z.object({
        value: z.string(),
        suffix: z.string().optional(),
        label: i18nTextSchema,
        icon: z.string().optional(),
      }),
    )
    .max(6)
    .default([]),
})

export const projectsBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('projects'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  status: z.enum(['all', 'planned', 'in_progress', 'completed']).default('all'),
  limit: z.number().int().min(1).max(12).default(3),
  featuredOnly: z.boolean().default(false),
  cta: ctaSchema.optional(),
})

export const postsBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('posts'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  categoryId: z.string().uuid().nullish(),
  limit: z.number().int().min(1).max(12).default(3),
  cta: ctaSchema.optional(),
})

export const campaignsBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('campaigns'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  limit: z.number().int().min(1).max(6).default(3),
  activeOnly: z.boolean().default(true),
})

export const donateBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('donate'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  campaignId: z.string().uuid().nullish(),
  suggestedAmounts: z.array(z.number().int().positive()).max(6).default([]),
  currency: z.string().length(3).optional(),
})

export const galleryBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('gallery'),
  title: i18nTextSchema.optional(),
  mediaIds: z.array(z.string().uuid()).default([]),
  columns: z.number().int().min(2).max(4).default(3),
  aspect: z.enum(['square', 'landscape', 'portrait']).default('landscape'),
})

export const partnersBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('partners'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  partnerIds: z.array(z.string().uuid()).default([]),
})

export const testimonialsBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('testimonials'),
  title: i18nTextSchema.optional(),
  testimonialIds: z.array(z.string().uuid()).default([]),
})

/**
 * The people who do the work, drawn from the team collection rather than typed
 * into the page.
 *
 * The same rows already carry article bylines and the qualifications listed on
 * the capability statement, so a member edited once is correct everywhere. A
 * hand-written list would be a second, competing answer to "who works here",
 * and would be wrong the first time somebody joins or leaves.
 */
export const teamBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('team'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  /** Empty means every published member, in their configured order. */
  memberIds: z.array(z.string().uuid()).default([]),
  columns: z.number().int().min(2).max(4).default(3),
  showBio: z.boolean().default(true),
  /** Qualifications are the point on a technical site; shown by default. */
  showCredentials: z.boolean().default(true),
  showContact: z.boolean().default(true),
})

export const faqBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('faq'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  faqIds: z.array(z.string().uuid()).default([]),
})

export const stepsBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('steps'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  items: z
    .array(
      z.object({
        title: i18nTextSchema,
        text: i18nTextSchema.optional(),
        icon: z.string().optional(),
      }),
    )
    .max(8)
    .default([]),
})

export const ctaBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('cta'),
  title: i18nTextSchema,
  text: i18nTextSchema.optional(),
  ctas: z.array(ctaSchema).max(2).default([]),
  mediaId: z.string().uuid().nullish(),
})

/**
 * A pin the editor places by hand.
 *
 * Water points come from the projects themselves and must keep doing so — a
 * borehole typed into a page section is a second copy that starts drifting the
 * day it is drilled. But plenty of things belong on this map without being a
 * project: the workshop, a district under contract, a site surveyed but not
 * yet opened. Those had nowhere to go, so the map could only ever show what
 * the projects table happened to hold.
 */
export const mapLocationSchema = z.object({
  label: i18nTextSchema,
  note: i18nTextSchema.optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const mapBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('map'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  zoom: z.number().int().min(3).max(14).default(7),
  center: z.object({ lat: z.number(), lng: z.number() }).default({ lat: 1.3733, lng: 32.2903 }),
  statuses: z.array(z.enum(['planned', 'in_progress', 'completed'])).default([
    'planned',
    'in_progress',
    'completed',
  ]),
  /** Generous rather than unbounded: a country programme, not a gazetteer. */
  locations: z.array(mapLocationSchema).max(60).default([]),
  /** A key for the pin colours, and the same points again as a list of links. */
  showLegend: z.boolean().default(true),
  showList: z.boolean().default(true),
})

export const videoBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('video'),
  title: i18nTextSchema.optional(),
  url: z.string(),
  caption: i18nTextSchema.optional(),
})

export const contactBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('contact'),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  variant: z.enum(['ngo', 'general']).default('ngo'),
  showDetails: z.boolean().default(true),
})

/**
 * A short, factual answer to one question, with the date it was last checked.
 *
 * The unit an answer engine quotes is two or three sentences, not a page.
 * Writing that unit deliberately — question, answer, date verified, source —
 * is the difference between being cited and being paraphrased away. The date
 * matters as much as the text: an unverifiable claim about water yield is
 * worth nothing to anyone deciding whether to repeat it.
 */
export const answerBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('answer'),
  question: i18nTextSchema,
  /** Two or three sentences. The editor is told so; it is not enforced. */
  answer: i18nTextSchema,
  /** ISO date the facts were last checked, shown to readers and machines. */
  verifiedOn: z.string().max(10).optional(),
  sourceLabel: z.string().max(160).optional(),
  sourceUrl: z.string().max(500).optional(),
})

/**
 * A data table, as a table.
 *
 * Figures pasted in as an image, or laid out with spans, are invisible to
 * anything that is not a human eye. Real `<table>` markup with a header row
 * is extractable by a crawler, readable by a screen reader, and copyable into
 * a spreadsheet by the NGO officer who needs the numbers.
 */
export const tableBlockSchema = z.object({
  ...baseFields,
  kind: z.literal('table'),
  title: i18nTextSchema.optional(),
  caption: i18nTextSchema.optional(),
  columns: z.array(i18nTextSchema).max(8).default([]),
  rows: z.array(z.array(i18nTextSchema).max(8)).max(200).default([]),
  /** Rendered as a unit note under the caption, e.g. "litres per hour". */
  unitNote: i18nTextSchema.optional(),
})

export const blockSchema = z.discriminatedUnion('kind', [
  heroBlockSchema,
  richTextBlockSchema,
  statsBlockSchema,
  projectsBlockSchema,
  postsBlockSchema,
  campaignsBlockSchema,
  donateBlockSchema,
  galleryBlockSchema,
  partnersBlockSchema,
  testimonialsBlockSchema,
  teamBlockSchema,
  faqBlockSchema,
  stepsBlockSchema,
  ctaBlockSchema,
  mapBlockSchema,
  videoBlockSchema,
  contactBlockSchema,
  answerBlockSchema,
  tableBlockSchema,
])

export const blocksSchema = z.array(blockSchema)

export type Block = z.infer<typeof blockSchema>
export type BlockKind = Block['kind']
export type HeroBlock = z.infer<typeof heroBlockSchema>
export type RichTextBlock = z.infer<typeof richTextBlockSchema>
export type StatsBlock = z.infer<typeof statsBlockSchema>
export type ProjectsBlock = z.infer<typeof projectsBlockSchema>
export type PostsBlock = z.infer<typeof postsBlockSchema>
export type CampaignsBlock = z.infer<typeof campaignsBlockSchema>
export type DonateBlock = z.infer<typeof donateBlockSchema>
export type GalleryBlock = z.infer<typeof galleryBlockSchema>
export type PartnersBlock = z.infer<typeof partnersBlockSchema>
export type TestimonialsBlock = z.infer<typeof testimonialsBlockSchema>
export type TeamBlock = z.infer<typeof teamBlockSchema>
export type FaqBlock = z.infer<typeof faqBlockSchema>
export type StepsBlock = z.infer<typeof stepsBlockSchema>
export type CtaBlock = z.infer<typeof ctaBlockSchema>
export type MapBlock = z.infer<typeof mapBlockSchema>
export type MapLocation = z.infer<typeof mapLocationSchema>
export type VideoBlock = z.infer<typeof videoBlockSchema>
export type AnswerBlock = z.infer<typeof answerBlockSchema>
export type TableBlock = z.infer<typeof tableBlockSchema>
export type ContactBlock = z.infer<typeof contactBlockSchema>

/** Drops blocks that no longer validate instead of failing a whole page. */
export function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return []

  const blocks: Block[] = []
  for (const entry of value) {
    const parsed = blockSchema.safeParse(entry)
    if (parsed.success) blocks.push(parsed.data)
  }
  return blocks
}

export const blockKinds = [
  'hero',
  'richText',
  'stats',
  'projects',
  'posts',
  'campaigns',
  'donate',
  'gallery',
  'partners',
  'testimonials',
  'team',
  'faq',
  'steps',
  'cta',
  'map',
  'video',
  'contact',
  'answer',
  'table',
] as const satisfies readonly BlockKind[]
