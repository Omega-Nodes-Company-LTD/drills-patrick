import nodemailer, { type Transporter } from 'nodemailer'
import { env, features } from '@/env'

/**
 * SMTP is optional. Without `SMTP_URL` every send is a no-op that logs once, so
 * donations and form submissions still succeed on an installation that has no
 * mail server yet.
 */

let transporter: Transporter | null = null
let warned = false

function getTransporter(): Transporter | null {
  if (!features.mail) {
    if (!warned) {
      console.warn('[mail] SMTP_URL is not set — emails are disabled.')
      warned = true
    }
    return null
  }

  transporter ??= nodemailer.createTransport(env.SMTP_URL!)
  return transporter
}

export type MailMessage = {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = getTransporter()
  if (!transport) return false

  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? message.html.replace(/<[^>]+>/g, ' '),
      replyTo: message.replyTo,
    })
    return true
  } catch (error) {
    console.error('[mail] send failed:', error)
    return false
  }
}

export async function verifyMailConnection(): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransporter()
  if (!transport) return { ok: false, error: 'SMTP_URL is not set.' }

  try {
    await transport.verify()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/** Minimal, inline-styled shell so messages look sane in every client. */
export function renderEmail(params: { title: string; body: string; footer?: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f1c26">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${params.title}</h1>
        <div style="font-size:15px;line-height:1.6">${params.body}</div>
        ${
          params.footer
            ? `<p style="margin:24px 0 0;font-size:13px;color:#5b6b78">${params.footer}</p>`
            : ''
        }
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}
