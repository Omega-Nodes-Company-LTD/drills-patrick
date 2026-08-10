import { getActiveTheme } from '@/lib/settings/service'
import { themeToCss, type ThemeTokens } from '@/lib/theme/tokens'

/**
 * Injects the active theme as a stylesheet in `<head>`.
 * Passing `tokens` renders an arbitrary theme instead of the active one, which
 * is what the admin live preview uses.
 */
export async function ThemeStyle({ tokens }: { tokens?: ThemeTokens }) {
  const css = tokens ? themeToCss(tokens) : themeToCss((await getActiveTheme()).tokens)

  return <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: css }} />
}

/**
 * Applies the visitor's stored light/dark preference before first paint so the
 * page never flashes the wrong palette.
 */
export function ThemeScript() {
  const script = `(function(){try{var p=localStorage.getItem('pw-theme');if(p==='dark'||p==='light'){document.documentElement.setAttribute('data-theme',p);}}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
