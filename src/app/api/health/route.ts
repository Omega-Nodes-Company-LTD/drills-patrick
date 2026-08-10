import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'

/** Used by the Docker HEALTHCHECK and by Coolify's readiness probe. */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ status: 'ok', database: 'up' })
  } catch (error) {
    return NextResponse.json(
      { status: 'degraded', database: 'down', error: error instanceof Error ? error.message : '' },
      { status: 503 },
    )
  }
}
