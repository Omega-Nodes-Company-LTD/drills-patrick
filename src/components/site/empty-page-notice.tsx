import { LayoutTemplate } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'

/**
 * A freshly installed site has empty pages. Visitors simply see nothing;
 * a signed-in editor gets a shortcut to the page builder instead of a blank
 * screen with no explanation.
 */
export async function EmptyPageNotice({ pageKey }: { pageKey?: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  const t = await getTranslations('admin.blocks')

  return (
    <div className="container-page py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-dashed border-border p-10 text-center">
        <LayoutTemplate className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">{t('empty')}</p>
        <Button asChild>
          <Link href={pageKey ? `/admin/pages/${pageKey}` : '/admin/pages'}>{t('add')}</Link>
        </Button>
      </div>
    </div>
  )
}
