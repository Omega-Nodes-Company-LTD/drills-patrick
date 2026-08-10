import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth/guard'
import { listMedia, listMediaFolders } from '@/lib/media/service'
import { mediaUrl } from '@/lib/storage/urls'

export const dynamic = 'force-dynamic'

/** Feeds the media library grid and the picker dialog. */
export async function GET(request: Request) {
  const user = await requireApiUser('media')
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })

  const url = new URL(request.url)
  const kindParam = url.searchParams.get('kind')

  const result = await listMedia({
    search: url.searchParams.get('q') ?? undefined,
    folder: url.searchParams.get('folder') ?? undefined,
    kind: kindParam === 'image' || kindParam === 'document' ? kindParam : undefined,
    page: Number(url.searchParams.get('page')) || 1,
    perPage: Math.min(Number(url.searchParams.get('perPage')) || 24, 60),
  })

  return NextResponse.json({
    ...result,
    items: result.items.map((item) => ({ ...item, url: mediaUrl(item.objectKey) })),
    folders: await listMediaFolders(),
  })
}
