import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ngoContacts, partners } from '@/db/schema'
import { env } from '@/env'
import { sendPartnerReport } from '@/lib/mail/notifications'
import { slaMetrics } from '@/lib/ngo/faults'
import { listPortalProjects, partnerProjectIds } from '@/lib/ngo/portal'
import type { Locale } from '@/i18n/config'

/**
 * Periodic report to each partner contact who asked for one.
 *
 * A partner that hears nothing assumes nothing is happening. The report is
 * opt-in per contact and carries the same figures the portal shows, so the
 * email and the site can never disagree.
 *
 * Schedule it daily in Coolify; the job itself decides who is due:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/cron/partner-reports
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorised(request: Request): boolean {
  if (!env.CRON_SECRET) return false
  return request.headers.get('authorization') === `Bearer ${env.CRON_SECRET}`
}

const INTERVAL_DAYS = { monthly: 30, quarterly: 91 } as const

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const now = new Date()

  const contacts = await db
    .select({ contact: ngoContacts, partnerName: partners.name })
    .from(ngoContacts)
    .innerJoin(partners, eq(partners.id, ngoContacts.partnerId))
    .where(
      and(
        eq(ngoContacts.isActive, true),
        inArray(ngoContacts.reportFrequency, ['monthly', 'quarterly']),
      ),
    )

  let sent = 0
  let skipped = 0

  for (const { contact, partnerName } of contacts) {
    const days = INTERVAL_DAYS[contact.reportFrequency as 'monthly' | 'quarterly']
    const due =
      !contact.lastReportAt ||
      now.getTime() - contact.lastReportAt.getTime() >= days * 24 * 60 * 60 * 1000

    if (!due) {
      skipped += 1
      continue
    }

    const locale = contact.locale as Locale
    const [projects, ids] = await Promise.all([
      listPortalProjects(contact.partnerId, locale),
      partnerProjectIds(contact.partnerId),
    ])

    // Nothing linked yet means nothing to report; sending an empty summary
    // would teach the reader to ignore the next one.
    if (projects.length === 0) {
      skipped += 1
      continue
    }

    const metrics = await slaMetrics({ projectIds: ids, sinceDays: days })

    const delivered = await sendPartnerReport({
      to: contact.email,
      name: contact.name,
      partnerName,
      locale,
      periodDays: days,
      projects: projects.map((project) => ({
        title: project.title,
        district: project.district,
        beneficiaries: project.beneficiaries,
        openFaults: project.openFaults,
      })),
      metrics,
    })

    if (delivered) {
      await db
        .update(ngoContacts)
        .set({ lastReportAt: now })
        .where(eq(ngoContacts.id, contact.id))
      sent += 1
    } else {
      // Not stamped: a failed send must be retried on the next run rather
      // than silently counted as delivered.
      skipped += 1
    }
  }

  return NextResponse.json({ ok: true, sent, skipped })
}
