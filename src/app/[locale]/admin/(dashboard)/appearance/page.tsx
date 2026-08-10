import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { NavigationEditor } from '@/components/admin/navigation-editor'
import { ThemeEditor } from '@/components/admin/theme-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Locale } from '@/i18n/config'
import { requirePermission } from '@/lib/auth/guard'
import { getActiveTheme, getNavigation } from '@/lib/settings/service'

export const dynamic = 'force-dynamic'

export default async function AppearancePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  await requirePermission('appearance')

  const [t, tNav, theme, header, footer, legal] = await Promise.all([
    getTranslations('admin.appearance'),
    getTranslations('admin.navigation'),
    getActiveTheme(),
    getNavigation('header'),
    getNavigation('footer'),
    getNavigation('legal'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} description={t('subtitle')} />

      <Tabs defaultValue="theme">
        <TabsList className="max-w-md">
          <TabsTrigger value="theme">{t('title')}</TabsTrigger>
          <TabsTrigger value="navigation">{tNav('title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="theme">
          <ThemeEditor initial={theme.tokens} />
        </TabsContent>

        <TabsContent value="navigation" className="flex flex-col gap-6">
          <NavigationEditor menuKey="header" title={tNav('header')} initial={header} />
          <NavigationEditor menuKey="footer" title={tNav('footer')} initial={footer} />
          <NavigationEditor menuKey="legal" title={tNav('legal')} initial={legal} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
