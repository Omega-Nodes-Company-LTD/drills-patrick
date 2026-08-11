import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { wellAdoptions } from '@/db/schema'
import { env } from '@/env'
import type { Locale } from '@/i18n/config'
import { adoptionsDue, projectTitleFor, updatesSince } from '@/lib/giving/adoptions'
import { deliverDueGiftCards } from '@/lib/giving/attach'
import { sendAdoptionUpdate } from '@/lib/mail/giving'

/**
 * The promises made at the moment of giving, kept on a schedule.
 *
 * Two jobs in one route because both are the same kind of debt: someone was
 * told something would arrive, and nothing in the request cycle will ever make
 * it happen. Schedule it daily in Coolify:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/cron/giving
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorised(request: Request): boolean {
  if (!env.CRON_SECRET) return false
  return request.headers.get('authorization') === `Bearer ${env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const now = new Date()
  let adoptionUpdates = 0
  let skipped = 0

  for (const adoption of await adoptionsDue(now)) {
    const locale = adoption.locale as Locale
    const project = await projectTitleFor(adoption.projectId, locale)
    if (!project) {
      skipped += 1
      continue
    }

    const updates = await updatesSince(adoption.projectId, adoption.lastUpdateSentAt, locale)

    try {
      // Sent even with nothing new. An adopter who hears nothing cannot tell
      // silence from neglect, and saying "no work was recorded this period" is
      // both true and better than leaving them to guess.
      await sendAdoptionUpdate({
        to: adoption.donorEmail,
        donorName: adoption.donorName,
        projectTitle: project.title,
        projectSlug: project.slug,
        updates,
        locale,
      })

      await db
        .update(wellAdoptions)
        .set({ lastUpdateSentAt: now })
        .where(eq(wellAdoptions.id, adoption.id))

      adoptionUpdates += 1
    } catch (error) {
      // Left unstamped on purpose, so the next run tries again rather than
      // recording a promise as kept when the email never left.
      console.error(`[cron/giving] adoption ${adoption.id} failed:`, error)
      skipped += 1
    }
  }

  const giftCards = await deliverDueGiftCards(now)

  return NextResponse.json({ adoptionUpdates, giftCards, skipped })
}
