import 'server-only'
import { defaultLocale, locales, pickI18n, type Locale } from '@/i18n/config'
import { listCampaigns, listFaqs, listPosts, listProjects } from '@/lib/content/queries'
import { localeUrl } from './index'
import { identityOf, formatAddress } from '@/lib/settings/identity'
import { getSiteSettings } from '@/lib/settings/service'
import { htmlToPlainText, truncate } from '@/lib/utils'

/**
 * `llms.txt` — a plain-text map of the site for language models.
 *
 * A crawler arriving at a JavaScript-rendered site has to guess what matters.
 * This states it: who runs the site, what it publishes, where the canonical
 * pages are, and — the part that decides whether anything gets quoted — under
 * what licence the content may be reused. A model that finds no licence has
 * to assume the strictest one.
 *
 * Two files, per the convention: `llms.txt` is an index, `llms-full.txt`
 * carries the text itself so a model does not have to fetch every page.
 */

const INDEX_LIMIT = 100
const FULL_LIMIT = 40

function licenceLine(settings: Awaited<ReturnType<typeof getSiteSettings>>): string {
  const { contentLicence, contentLicenceUrl } = settings.seo

  if (!contentLicence) {
    // Silence is not permission, and saying so is more useful than saying
    // nothing: it tells the reader where to ask.
    const email = settings.contact.email
    return `> Licence: not stated. Ask before reuse${email ? ` (${email})` : ''}.`
  }

  return `> Licence: ${contentLicence}${contentLicenceUrl ? ` — ${contentLicenceUrl}` : ''}. Attribution: ${settings.siteName}.`
}

function section(title: string, lines: string[]): string {
  return lines.length > 0 ? `## ${title}\n\n${lines.join('\n')}\n` : ''
}

export async function buildLlmsIndex(locale: Locale): Promise<string> {
  const settings = await getSiteSettings()
  const identity = identityOf(settings)

  const [projects, posts, campaigns, faqs] = await Promise.all([
    listProjects({ locale, limit: INDEX_LIMIT }),
    listPosts({ locale, limit: INDEX_LIMIT }),
    listCampaigns({ locale, limit: 30 }),
    listFaqs(locale),
  ])

  const description = pickI18n(settings.description, locale) || ''
  const address = formatAddress(identity)

  // Optional lines are dropped before the blank lines are added, so the file
  // keeps the blank-line structure markdown needs.
  const facts = [
    `- Type: non-governmental organisation${identity.registrationNumber ? ` (registration ${identity.registrationNumber})` : ''}`,
    address ? `- Based in: ${address}` : null,
    identity.email ? `- Contact: ${identity.email}` : null,
    `- Languages: ${settings.enabledLocales.join(', ')}`,
    `- Machine-readable project data: ${localeUrl(defaultLocale, '/projects.json')}`,
    `- Full text: ${localeUrl(locale, '/llms-full.txt')}`,
  ].filter((line): line is string => Boolean(line))

  const head = [
    `# ${settings.siteName}`,
    '',
    ...(description ? [`> ${description}`, ''] : []),
    licenceLine(settings),
    '',
    '## About',
    '',
    ...facts,
    '',
  ].join('\n')

  const body = [
    section(
      'Projects',
      projects.items.map((project) => {
        const place = [project.district, project.region].filter(Boolean).join(', ')
        return `- [${project.title}](${localeUrl(locale, `/projects/${project.slug}`)})${place ? ` — ${place}` : ''}`
      }),
    ),
    section(
      'Articles',
      posts.items.map(
        (post) => `- [${post.title}](${localeUrl(locale, `/blog/${post.slug}`)})`,
      ),
    ),
    section(
      'Fundraising',
      campaigns.items.map(
        (campaign) => `- [${campaign.title}](${localeUrl(locale, `/campaigns/${campaign.slug}`)})`,
      ),
    ),
    section(
      'Questions answered on this site',
      faqs.map((faq) => `- ${faq.question}`),
    ),
  ]
    .filter(Boolean)
    .join('\n')

  return `${head}\n${body}`
}

export async function buildLlmsFull(locale: Locale): Promise<string> {
  const settings = await getSiteSettings()

  const [projects, posts, faqs] = await Promise.all([
    listProjects({ locale, limit: FULL_LIMIT }),
    listPosts({ locale, limit: FULL_LIMIT }),
    listFaqs(locale),
  ])

  const parts: string[] = [`# ${settings.siteName}`, '', licenceLine(settings), '']

  if (projects.items.length > 0) {
    parts.push('## Projects', '')
    for (const project of projects.items) {
      const facts = [
        project.district && `district: ${project.district}`,
        project.beneficiaries > 0 && `people served: ${project.beneficiaries}`,
        project.depthMeters && `depth: ${project.depthMeters} m`,
        project.completionDate && `completed: ${project.completionDate}`,
      ].filter(Boolean)

      parts.push(
        `### ${project.title}`,
        localeUrl(locale, `/projects/${project.slug}`),
        facts.length > 0 ? facts.join(' · ') : '',
        project.summary ?? '',
        '',
      )
    }
  }

  if (posts.items.length > 0) {
    parts.push('## Articles', '')
    for (const post of posts.items) {
      parts.push(
        `### ${post.title}`,
        localeUrl(locale, `/blog/${post.slug}`),
        post.publishedAt ? `Published ${post.publishedAt.toISOString().slice(0, 10)}` : '',
        post.excerpt ?? '',
        '',
      )
    }
  }

  if (faqs.length > 0) {
    parts.push('## Questions and answers', '')
    for (const faq of faqs) {
      parts.push(`### ${faq.question}`, truncate(htmlToPlainText(faq.answerHtml), 1200), '')
    }
  }

  return parts.filter((line) => line !== undefined).join('\n')
}

/** Shared by both routes: an unknown or disabled language has no file. */
export function resolveLlmsLocale(raw: string, enabled: readonly Locale[]): Locale | null {
  if (!(locales as readonly string[]).includes(raw)) return null
  return enabled.includes(raw as Locale) ? (raw as Locale) : null
}
