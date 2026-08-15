import { expect, test, type Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe2026!'

/**
 * The mobile-first guarantees, checked at the narrowest width the design is
 * meant to hold: 360px.
 *
 * These only run in the `mobile` project — the desktop one has no touch
 * emulation, so the target-size and drawer assertions would be meaningless
 * there.
 */
test.use({ viewport: { width: 360, height: 740 } })

test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, 'mobile project only')
})

/** True when the page is rendered as a document wider than the viewport. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    // A 1px tolerance: sub-pixel rounding of a full-width element is not a bug.
    return doc.scrollWidth - doc.clientWidth > 1
  })
}

async function signIn(page: Page) {
  await page.goto('/en/admin/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test.describe('no horizontal scrolling', () => {
  const publicRoutes = [
    '/',
    '/projects',
    '/blog',
    '/campaigns',
    '/donate',
    '/data',
    '/spending',
    '/search?q=water',
  ]

  for (const path of publicRoutes) {
    test(`${path} fits a 360px viewport`, async ({ page }) => {
      await page.goto(path)
      expect(await horizontalOverflow(page), `${path} scrolls sideways`).toBe(false)
    })
  }

  test('the header survives a long site name', async ({ page }) => {
    // The name is `truncate`d, so without `min-w-0` on the flex row its
    // min-content width is the whole string and it pushes the menu button off
    // the screen. Reproduced by lengthening the rendered name in place.
    await page.goto('/')
    await page.evaluate(() => {
      const brand = document.querySelector('header a span:last-of-type')
      if (brand) brand.textContent = 'A Very Long Organisation Name That Should Truncate Instead'
    })

    expect(await horizontalOverflow(page)).toBe(false)
    await expect(page.getByRole('button', { name: 'Menu' })).toBeInViewport()
  })

  test('the admin dashboard fits a 360px viewport', async ({ page }) => {
    await signIn(page)
    expect(await horizontalOverflow(page)).toBe(false)
  })
})

test.describe('navigation drawer', () => {
  test('opens, closes on Escape and returns focus to the trigger', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Menu' })

    // The click can land before hydration attaches the handler, so retry until
    // the trigger reports itself open rather than waiting on a lost click.
    await expect(async () => {
      await trigger.click()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    }).toPass({ timeout: 20_000 })

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('keeps its links out of the tab order while closed', async ({ page }) => {
    // The hand-rolled drawer this replaced left every link focusable behind an
    // `aria-hidden` wrapper — reachable by keyboard, invisible to a reader.
    await page.goto('/')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('the admin drawer behaves the same way', async ({ page }) => {
    await signIn(page)
    const trigger = page.getByRole('button', { name: 'Menu' })

    await expect(async () => {
      await trigger.click()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    }).toPass({ timeout: 20_000 })

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe('touch ergonomics', () => {
  test('the admin action bar puts Save in reach without scrolling', async ({ page }) => {
    // The publish controls live in a side rail that collapses to the very
    // bottom of the page on a phone, behind five languages of fields.
    await signIn(page)
    await page.goto('/en/admin/projects/new')

    // The form carries two: the side-rail one, which on a phone sits at the
    // very bottom of the page, and the action bar's, which is the last in the
    // DOM and has to be on screen without scrolling.
    const save = page.getByRole('button', { name: 'Save' })
    await expect(save.last()).toBeInViewport()
  })

  test('icon buttons in the admin lists are at least 44px on touch', async ({ page }) => {
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
    test.skip(!coarse, 'the browser does not report a coarse pointer')

    await signIn(page)
    await page.goto('/en/admin/pages')

    const edit = page.getByRole('link', { name: 'Edit' }).first()
    await expect(edit).toBeVisible()

    // The painted box stays small; it is the hit area that has to reach 44px,
    // so the pseudo-element is measured rather than the button itself.
    const hit = await edit.evaluate((node) => {
      const box = getComputedStyle(node, '::after')
      return { width: parseFloat(box.minWidth), height: parseFloat(box.minHeight) }
    })

    expect(hit.width).toBeGreaterThanOrEqual(44)
    expect(hit.height).toBeGreaterThanOrEqual(44)
  })

  test('the theme toggle grows its buttons on touch', async ({ page }) => {
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
    test.skip(!coarse, 'the browser does not report a coarse pointer')

    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Menu' })
    await expect(async () => {
      await trigger.click()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    }).toPass({ timeout: 20_000 })

    // Three segments 2px apart: these have to grow rather than overlap.
    const segment = page.getByRole('dialog').getByRole('button', { name: 'System' })
    const box = await segment.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('form controls are large enough not to trigger iOS zoom', async ({ page }) => {
    // Safari zooms the viewport whenever a focused control is under 16px.
    await page.goto('/donate')

    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll('input, select, textarea')]
        .filter((node) => (node as HTMLElement).offsetParent !== null)
        .map((node) => parseFloat(getComputedStyle(node).fontSize)),
    )

    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16)
  })
})
