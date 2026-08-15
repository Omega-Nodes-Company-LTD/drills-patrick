'use client'

import {
  BarChart3,
  Calculator,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderTree,
  HandCoins,
  Handshake,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mailbox,
  Menu,
  MessageSquare,
  Newspaper,
  Palette,
  Quote,
  Scale,
  Settings,
  TriangleAlert,
  UserRound,
  Users,
  Droplets,
  Megaphone,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import type { Permission } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ThemeToggle } from '@/components/theme/theme-toggle'

type NavEntry = {
  href: string
  labelKey: string
  icon: typeof LayoutDashboard
  permission?: Permission
  exact?: boolean
}

const GROUPS: { titleKey: string; items: NavEntry[] }[] = [
  {
    titleKey: 'dashboard',
    items: [{ href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    titleKey: 'content',
    items: [
      { href: '/admin/pages', labelKey: 'pages', icon: FileText, permission: 'content' },
      { href: '/admin/posts', labelKey: 'posts', icon: Newspaper, permission: 'content' },
      { href: '/admin/categories', labelKey: 'categories', icon: FolderTree, permission: 'content' },
      { href: '/admin/projects', labelKey: 'projects', icon: Droplets, permission: 'projects' },
      { href: '/admin/campaigns', labelKey: 'campaigns', icon: Megaphone, permission: 'content' },
      { href: '/admin/faults', labelKey: 'faults', icon: TriangleAlert, permission: 'projects' },
      { href: '/admin/quotes', labelKey: 'quotes', icon: Calculator, permission: 'projects' },
      { href: '/admin/contracts', labelKey: 'contracts', icon: CalendarClock, permission: 'projects' },
      { href: '/admin/media', labelKey: 'media', icon: ImageIcon, permission: 'media' },
    ],
  },
  {
    titleKey: 'collections',
    items: [
      { href: '/admin/faqs', labelKey: 'faqs', icon: HelpCircle, permission: 'content' },
      { href: '/admin/team', labelKey: 'team', icon: UserRound, permission: 'content' },
      { href: '/admin/partners', labelKey: 'partners', icon: Handshake, permission: 'content' },
      {
        href: '/admin/testimonials',
        labelKey: 'testimonials',
        icon: Quote,
        permission: 'content',
      },
    ],
  },
  {
    titleKey: 'donations',
    items: [
      { href: '/admin/donations', labelKey: 'donations', icon: HandCoins, permission: 'donations' },
      { href: '/admin/inquiries', labelKey: 'inquiries', icon: Mailbox, permission: 'inquiries' },
      { href: '/admin/messages', labelKey: 'messages', icon: MessageSquare, permission: 'inquiries' },
    ],
  },
  {
    titleKey: 'settings',
    items: [
      { href: '/admin/appearance', labelKey: 'appearance', icon: Palette, permission: 'appearance' },
      { href: '/admin/settings', labelKey: 'settings', icon: Settings, permission: 'settings' },
      { href: '/admin/users', labelKey: 'users', icon: Users, permission: 'users' },
      {
        href: '/admin/partner-access',
        labelKey: 'partnerAccess',
        icon: KeyRound,
        permission: 'users',
      },
      {
        href: '/admin/transparency',
        labelKey: 'transparency',
        icon: Scale,
        permission: 'settings',
      },
      { href: '/admin/audit', labelKey: 'audit', icon: BarChart3, permission: 'settings' },
    ],
  },
]

/**
 * Admin chrome: a permanent sidebar from `lg` upwards and an off-canvas drawer
 * on phones. Entries the signed-in role cannot reach are not rendered at all.
 */
export function AdminShell({
  children,
  user,
  permissions,
  siteName,
  signOutAction,
}: {
  children: ReactNode
  user: { name: string; email: string; role: string }
  permissions: Permission[]
  siteName: string
  signOutAction: () => Promise<void>
}) {
  const t = useTranslations('admin.nav')
  const tCommon = useTranslations('common')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const allowed = (entry: NavEntry) => !entry.permission || permissions.includes(entry.permission)

  const isActive = (entry: NavEntry) =>
    entry.exact ? pathname === entry.href : pathname.startsWith(entry.href)

  /*
   * Rendered twice — once in the permanent sidebar, once inside the drawer —
   * but only ever one of the two is in the tree at a given width, so the
   * navigation landmark is not duplicated in the accessibility tree. Inside the
   * drawer the brand row has to keep clear of the dialog's close button.
   */
  const renderSidebar = (inDrawer: boolean) => (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <Link
        href="/admin"
        className={cn(
          'flex items-center gap-2 px-2 font-heading text-base font-bold',
          inDrawer && 'pe-10',
        )}
      >
        <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
          {siteName.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{siteName}</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-5">
        {GROUPS.map((group) => {
          const items = group.items.filter(allowed)
          if (items.length === 0) return null

          return (
            <div key={group.titleKey} className="flex flex-col gap-1">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.titleKey)}
              </p>
              {items.map((entry) => {
                const Icon = entry.icon
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    aria-current={isActive(entry) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium transition-colors',
                      isActive(entry)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {t(entry.labelKey)}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-4" aria-hidden />
          {t('viewSite')}
        </Link>

        <div className="flex items-center justify-between gap-2 px-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <ThemeToggle />
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
          >
            <LogOut className="size-4" aria-hidden />
            {t('signOut')}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-e border-border bg-surface lg:block">
        <div className="sticky top-0 h-dvh">{renderSidebar(false)}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          {/*
            Built on the `Dialog` primitive rather than by hand: Escape, the
            focus trap, returning focus to the trigger, locking the background
            scroll and keeping the closed panel out of the tab order all come
            from Radix instead of being reimplemented here.
          */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              aria-label={tCommon('menu')}
              className="grid size-9 place-items-center rounded-[var(--radius-sm)] touch-target hover:bg-muted"
            >
              <Menu className="size-5" aria-hidden />
            </DialogTrigger>

            <DialogContent
              side="start"
              closeLabel={tCommon('close')}
              aria-describedby={undefined}
              className="w-[min(17rem,85vw)] bg-surface lg:hidden"
            >
              <DialogTitle className="sr-only">{tCommon('menu')}</DialogTitle>
              {renderSidebar(true)}
            </DialogContent>
          </Dialog>

          <span className="min-w-0 truncate font-heading font-semibold">{siteName}</span>
          <ChevronDown className="ms-auto size-4 shrink-0 opacity-0" aria-hidden />
        </header>

        {/*
          The bottom padding leaves room for the sticky action bar the long
          admin forms render below `lg` (see form-action-bar.tsx).
        */}
        <main className="flex-1 p-4 pb-24 md:p-6 lg:p-8 lg:pb-8">{children}</main>
      </div>
    </div>
  )
}
