import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { auditLog, users } from '@/db/schema'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Records an admin mutation. Failures are swallowed on purpose: losing an audit
 * entry must never break the operation the user asked for.
 */
export async function recordAudit(params: {
  actor: SessionUser | null
  action: string
  entityType: string
  entityId?: string | null
  summary?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: params.actor?.id ?? null,
      actorEmail: params.actor?.email ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary ?? null,
      payload: params.payload ?? null,
    })
  } catch (error) {
    console.error('[audit] failed to record entry:', error)
  }
}

export async function listAuditEntries(limit = 100) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      summary: auditLog.summary,
      createdAt: auditLog.createdAt,
      actorEmail: auditLog.actorEmail,
      actorName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
}
