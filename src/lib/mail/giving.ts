import type { Locale } from '@/i18n/config'
import { formatMoney } from '@/lib/money'
import { getSiteSettings } from '@/lib/settings/service'
import { absoluteUrl } from '@/lib/url'
import type { LegacyEnquiryInput } from '@/lib/validation/giving'

import { renderEmail, sendMail } from './mailer'

/** Emails the supporter-facing giving flows send. */

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function internalRecipient(): Promise<string | null> {
  const settings = await getSiteSettings()
  return settings.contact.email ?? null
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escape(href)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0a6d8f;color:#fff;text-decoration:none;font-weight:600">${escape(label)}</a></p>`
}

/**
 * The owner's only copy of their management link.
 *
 * The token is never stored in a readable form, so if this email does not
 * arrive the page cannot be edited by anyone, ever. That is the intended
 * trade — it also means nobody who gets hold of the database can edit it.
 */
export async function sendFundraiserLink(params: {
  to: string
  ownerName: string
  title: string
  slug: string
  token: string
  locale: Locale
}): Promise<void> {
  const manageUrl = absoluteUrl(
    `/${params.locale}/fundraisers/${params.slug}/manage?token=${encodeURIComponent(params.token)}`,
  )

  await sendMail({
    to: params.to,
    subject: `Your fundraising page: ${params.title}`,
    html: renderEmail({
      title: 'Your fundraising page',
      body:
        `<p>Thank you, ${escape(params.ownerName)}. Your page <strong>${escape(params.title)}</strong> has been created and is waiting for a quick review before it goes live.</p>` +
        `<p>Keep this email. The link below is the only way to edit your page, and we cannot send it again — it is not stored anywhere we can read.</p>` +
        button(manageUrl, 'Edit my page') +
        `<p style="font-size:13px;color:#5b6b78;word-break:break-all">${escape(manageUrl)}</p>`,
    }),
  })
}

export async function notifyFundraiserStarted(params: {
  title: string
  ownerName: string
  slug: string
}): Promise<void> {
  const to = await internalRecipient()
  if (!to) return

  await sendMail({
    to,
    subject: `Fundraising page awaiting review: ${params.title}`,
    html: renderEmail({
      title: 'A supporter started a fundraising page',
      body:
        `<p><strong>${escape(params.ownerName)}</strong> created <strong>${escape(params.title)}</strong>.</p>` +
        `<p>It carries your name, so it stays hidden until someone approves it.</p>` +
        button(absoluteUrl('/en/admin/fundraisers'), 'Review it'),
    }),
  })
}

export async function notifyLegacyEnquiry(input: LegacyEnquiryInput): Promise<void> {
  const to = await internalRecipient()
  if (!to) return

  await sendMail({
    to,
    replyTo: input.email,
    subject: `Legacy or major gift enquiry from ${input.name}`,
    html: renderEmail({
      title: 'Someone is asking about a large or personal gift',
      body:
        `<p><strong>${escape(input.name)}</strong> (${escape(input.email)}) wrote about a <strong>${escape(input.kind.replace('_', ' '))}</strong>.</p>` +
        (input.preferredContact
          ? `<p>They would rather be contacted: ${escape(input.preferredContact)}</p>`
          : '') +
        `<p style="white-space:pre-wrap">${escape(input.message)}</p>` +
        `<p style="color:#5b6b78">These deserve a reply from a named person within a few days.</p>`,
    }),
  })
}

/** The link a donor uses to pause, change or stop a standing gift. */
export async function sendRecurringLink(params: {
  to: string
  donorName: string | null
  reference: string
  token: string
  amountMinor: number
  currency: string
  interval: string
  locale: Locale
}): Promise<void> {
  const manageUrl = absoluteUrl(
    `/${params.locale}/giving/manage?ref=${encodeURIComponent(params.reference)}&token=${encodeURIComponent(params.token)}`,
  )

  await sendMail({
    to: params.to,
    subject: 'Your regular gift',
    html: renderEmail({
      title: 'Your regular gift',
      body:
        `<p>${params.donorName ? `Thank you, ${escape(params.donorName)}.` : 'Thank you.'} Your ${escape(params.interval)} gift of <strong>${escape(formatMoney(params.amountMinor, params.currency, params.locale))}</strong> is set up.</p>` +
        `<p>You can pause it, change the amount or stop it at any time, without writing to anyone:</p>` +
        button(manageUrl, 'Manage my gift') +
        `<p style="font-size:13px;color:#5b6b78;word-break:break-all">${escape(manageUrl)}</p>`,
    }),
  })
}

/** The card a solidarity gift buys, sent to the person it is for. */
export async function sendGiftCard(params: {
  to: string
  recipientName: string
  senderName: string
  message: string
  token: string
  locale: Locale
}): Promise<void> {
  const cardUrl = absoluteUrl(`/${params.locale}/gift/${encodeURIComponent(params.token)}`)

  await sendMail({
    to: params.to,
    subject: `${params.senderName} has given a gift in your name`,
    html: renderEmail({
      title: 'A gift in your name',
      body:
        `<p>${escape(params.recipientName)},</p>` +
        `<p><strong>${escape(params.senderName)}</strong> has funded clean water in your name.</p>` +
        (params.message ? `<blockquote style="margin:16px 0;padding-left:16px;border-left:3px solid #0a6d8f;white-space:pre-wrap">${escape(params.message)}</blockquote>` : '') +
        button(cardUrl, 'See your card'),
    }),
  })
}

/** A yearly summary a donor can hand to their accountant. */
export async function sendAnnualStatement(params: {
  to: string
  donorName: string | null
  year: number
  token: string
  totalMinor: number
  currency: string
  giftCount: number
  locale: Locale
}): Promise<void> {
  const statementUrl = absoluteUrl(
    `/${params.locale}/giving/statement?token=${encodeURIComponent(params.token)}&year=${params.year}`,
  )

  await sendMail({
    to: params.to,
    subject: `Your ${params.year} giving summary`,
    html: renderEmail({
      title: `Your ${params.year} giving summary`,
      body:
        `<p>${params.donorName ? `${escape(params.donorName)},` : 'Hello,'} in ${params.year} you gave <strong>${escape(formatMoney(params.totalMinor, params.currency, params.locale))}</strong> across ${params.giftCount} gift${params.giftCount === 1 ? '' : 's'}.</p>` +
        `<p>The full statement lists every gift with its date and reference:</p>` +
        button(statementUrl, 'Open my statement'),
    }),
  })
}

/** The periodic update promised to someone who adopted a water point. */
export async function sendAdoptionUpdate(params: {
  to: string
  donorName: string
  projectTitle: string
  projectSlug: string
  updates: { happenedOn: string; title: string; body: string }[]
  locale: Locale
}): Promise<void> {
  const projectUrl = absoluteUrl(`/${params.locale}/projects/${params.projectSlug}`)

  const items = params.updates
    .map(
      (update) =>
        `<li style="margin-bottom:12px"><strong>${escape(update.title)}</strong><br><span style="color:#5b6b78;font-size:13px">${escape(update.happenedOn)}</span><br>${escape(update.body)}</li>`,
    )
    .join('')

  await sendMail({
    to: params.to,
    subject: `${params.projectTitle}: how your water point is doing`,
    html: renderEmail({
      title: params.projectTitle,
      body:
        `<p>${escape(params.donorName)}, here is what has happened at the water point you support.</p>` +
        (items
          ? `<ul style="padding-left:18px">${items}</ul>`
          : '<p>No new work was recorded this period. We are telling you anyway, because silence should not be something you have to interpret.</p>') +
        button(projectUrl, 'See the water point'),
    }),
  })
}
