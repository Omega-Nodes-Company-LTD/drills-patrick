import { formatAddress, formatLegalLine, identityOf } from '@/lib/settings/identity'
import { getSiteSettings } from '@/lib/settings/service'
import { absoluteUrl } from '@/lib/url'
import { formatMoney } from '@/lib/money'
import type { ContactInput, NgoInquiryInput } from '@/lib/validation/public'
import type { DonationRow } from '@/db/schema'

import { renderEmail, sendMail } from './mailer'

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rows(entries: [string, string | number | null | undefined][]): string {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#5b6b78">${escape(label)}</td><td style="padding:4px 0"><strong>${escape(String(value))}</strong></td></tr>`,
    )
    .join('')
}

/** Where internal notifications go: the configured contact address. */
async function internalRecipient(): Promise<string | null> {
  const settings = await getSiteSettings()
  return settings.contact.email ?? null
}

export async function notifyContactSubmission(input: ContactInput): Promise<void> {
  const to = await internalRecipient()
  if (!to) return

  await sendMail({
    to,
    replyTo: input.email,
    subject: `New message from ${input.name}`,
    html: renderEmail({
      title: 'New contact message',
      body: `<table role="presentation">${rows([
        ['Name', input.name],
        ['Email', input.email],
        ['Phone', input.phone],
        ['Subject', input.subject],
        ['Language', input.locale],
      ])}</table><p style="margin-top:16px;white-space:pre-wrap">${escape(input.message)}</p>`,
    }),
  })
}

export async function notifyNgoInquiry(input: NgoInquiryInput): Promise<void> {
  const to = await internalRecipient()
  if (!to) return

  await sendMail({
    to,
    replyTo: input.email,
    subject: `Quote request — ${input.organisationName}`,
    html: renderEmail({
      title: 'New NGO inquiry',
      body: `<table role="presentation">${rows([
        ['Organisation', input.organisationName],
        ['Contact', input.contactName],
        ['Email', input.email],
        ['Phone', input.phone],
        ['Country', input.country],
        ['Region', input.region],
        ['Intervention', input.interventionType],
        ['Water points', input.wellsRequested],
        ['Beneficiaries', input.beneficiariesEstimate],
        ['Budget', input.budget ? `${input.budget} ${input.currency ?? ''}` : null],
        ['Timeframe', input.timeframe],
      ])}</table><p style="margin-top:16px;white-space:pre-wrap">${escape(input.message)}</p>`,
      footer: `Open the admin area to assign this inquiry: ${absoluteUrl('/admin/inquiries')}`,
    }),
  })
}

/** Receipt sent to the donor once a payment is confirmed. */
export async function sendDonationReceipt(donation: DonationRow): Promise<boolean> {
  if (!donation.donorEmail) return false

  const settings = await getSiteSettings()
  const identity = identityOf(settings)
  const amount = formatMoney(donation.amountMinor, donation.currency, donation.locale)

  return sendMail({
    to: donation.donorEmail,
    subject: `${settings.siteName} — donation receipt ${donation.receiptNumber ?? donation.reference}`,
    html: renderEmail({
      title: 'Thank you for your donation',
      body: `<table role="presentation">${rows([
        ['Amount', amount],
        ['Reference', donation.reference],
        ['Receipt number', donation.receiptNumber],
        ['Method', donation.provider],
        ['Date', donation.confirmedAt?.toISOString().slice(0, 10) ?? ''],
      ])}</table>`,
      // Same identity line the footer shows, plus the postal address: a
      // receipt that names a different body than the site is worth less to
      // the donor's accountant and to anyone verifying the organisation.
      footer: [formatLegalLine(identity), formatAddress(identity), identity.email]
        .filter(Boolean)
        .join('<br>'),
    }),
  })
}

/** Bank-transfer instructions, sent as soon as the donor picks that method. */
export async function sendBankTransferInstructions(
  donation: DonationRow,
  instructionsHtml: string,
): Promise<boolean> {
  if (!donation.donorEmail) return false

  const settings = await getSiteSettings()
  const bank = settings.bankTransfer
  const amount = formatMoney(donation.amountMinor, donation.currency, donation.locale)

  return sendMail({
    to: donation.donorEmail,
    subject: `${settings.siteName} — bank transfer details`,
    html: renderEmail({
      title: 'Bank transfer details',
      body: `<table role="presentation">${rows([
        ['Amount', amount],
        ['Reference to quote', donation.reference],
        ['Account name', bank.accountName],
        ['Bank', bank.bankName],
        ['Account number', bank.accountNumber],
        ['IBAN', bank.iban],
        ['SWIFT', bank.swift],
        ['Branch', bank.branch],
      ])}</table>${instructionsHtml ? `<div style="margin-top:16px">${instructionsHtml}</div>` : ''}`,
    }),
  })
}
