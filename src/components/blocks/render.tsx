import type { Locale } from '@/i18n/config'
import type { Block } from '@/lib/blocks/schema'
import { HeroBlockView } from './hero-block'
import {
  AnswerBlockView,
  CtaBlockView,
  GalleryBlockView,
  RichTextBlockView,
  StatsBlockView,
  StepsBlockView,
  TableBlockView,
  VideoBlockView,
} from './simple-blocks'
import {
  CampaignsBlockView,
  ContactBlockView,
  DonateBlockView,
  FaqBlockView,
  MapBlockView,
  PartnersBlockView,
  PostsBlockView,
  ProjectsBlockView,
  TeamBlockView,
  TestimonialsBlockView,
} from './data-blocks'

/**
 * Renders one block. Every branch receives the already-validated block, so an
 * unknown `kind` can only appear if the schema and this switch drift apart —
 * in which case nothing is rendered rather than the page crashing.
 */
export function BlockView({ block, locale }: { block: Block; locale: Locale }) {
  if (!block.enabled) return null

  switch (block.kind) {
    case 'hero':
      return <HeroBlockView block={block} locale={locale} />
    case 'richText':
      return <RichTextBlockView block={block} locale={locale} />
    case 'stats':
      return <StatsBlockView block={block} locale={locale} />
    case 'steps':
      return <StepsBlockView block={block} locale={locale} />
    case 'cta':
      return <CtaBlockView block={block} locale={locale} />
    case 'gallery':
      return <GalleryBlockView block={block} locale={locale} />
    case 'video':
      return <VideoBlockView block={block} locale={locale} />
    case 'projects':
      return <ProjectsBlockView block={block} locale={locale} />
    case 'posts':
      return <PostsBlockView block={block} locale={locale} />
    case 'campaigns':
      return <CampaignsBlockView block={block} locale={locale} />
    case 'partners':
      return <PartnersBlockView block={block} locale={locale} />
    case 'testimonials':
      return <TestimonialsBlockView block={block} locale={locale} />
    case 'team':
      return <TeamBlockView block={block} locale={locale} />
    case 'faq':
      return <FaqBlockView block={block} locale={locale} />
    case 'map':
      return <MapBlockView block={block} locale={locale} />
    case 'answer':
      return <AnswerBlockView block={block} locale={locale} />
    case 'table':
      return <TableBlockView block={block} locale={locale} />
    case 'contact':
      return <ContactBlockView block={block} locale={locale} />
    case 'donate':
      return <DonateBlockView block={block} locale={locale} />
    default:
      return null
  }
}

export function BlockList({ blocks, locale }: { blocks: Block[]; locale: Locale }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} locale={locale} />
      ))}
    </>
  )
}
