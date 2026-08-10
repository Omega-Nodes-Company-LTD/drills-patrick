import { expect, test } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe2026!'

test.describe('public site', () => {
  test('serves the home page and the main routes', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()

    for (const path of ['/projects', '/blog', '/campaigns', '/donate']) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should not error`).toBeLessThan(400)
    }
  })

  test('switches locale through the prefix', async ({ page }) => {
    await page.goto('/fr/projects')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    await page.goto('/it/projects')
    await expect(page.locator('html')).toHaveAttribute('lang', 'it')
  })

  test('exposes robots and sitemap', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200)
    expect((await request.get('/sitemap.xml')).status()).toBe(200)
  })

  test('reports database health', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    expect((await response.json()).database).toBe('up')
  })

  test('always offers bank transfer on the donation form', async ({ page }) => {
    await page.goto('/donate')
    await expect(page.getByRole('button', { name: /bank transfer/i })).toBeVisible()
  })
})

test.describe('admin', () => {
  test('rejects the wrong password', async ({ page }) => {
    await page.goto('/en/admin/login')

    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill('definitely-wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.locator('p[role="alert"]')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('signs in and reaches the dashboard', async ({ page }) => {
    await page.goto('/en/admin/login')

    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('redirects an anonymous visitor away from the dashboard', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/en/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})

test.describe('regressions', () => {
  test('gives each page its own canonical', async ({ page }) => {
    // Every page used to inherit the home page's canonical from the layout,
    // which pointed search engines at the home page for the whole site.
    await page.goto('/projects')
    const canonical = page.locator('link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', /\/projects$/)

    await page.goto('/it/projects')
    await expect(canonical).toHaveAttribute('href', /\/it\/projects$/)
  })

  test('pairs a page with its translations through hreflang', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1)
    await expect(page.locator('link[rel="alternate"][hreflang="it"]')).toHaveAttribute(
      'href',
      /\/it\/blog$/,
    )
  })

  test('leaves a donation alone when the URL says it was cancelled', async ({ request }) => {
    // ?cancelled=1 used to write the cancelled status straight from the query
    // string: anyone holding a reference could close someone else's donation
    // with a GET, and a link prefetch was enough to fire it.
    const response = await request.get('/donate/status?ref=does-not-exist&cancelled=1')
    expect(response.status()).toBe(404)
  })

  test('keeps the language switcher on the current section', async ({ page }) => {
    // Switching language used to drop the visitor back on the home page.
    await page.goto('/projects')

    // Below `lg` the switcher lives inside the off-canvas menu.
    const switcher = page.getByRole('combobox', { name: 'English' })
    if (!(await switcher.first().isVisible())) {
      await page.getByRole('button', { name: 'Menu' }).click()
    }

    await switcher.filter({ visible: true }).first().selectOption('fr')
    await expect(page).toHaveURL(/\/fr\/projects/)
  })

  test('does not advertise API routes to crawlers', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.headers()['x-robots-tag']).toContain('noindex')
  })

  test('sends the security headers', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })
})

test.describe('feeds and machine-readable routes', () => {
  test('serves an RSS feed per language', async ({ request }) => {
    const response = await request.get('/feed.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/rss+xml')

    const body = await response.text()
    expect(body).toContain('<rss version="2.0"')
    expect(body).toContain('<language>en</language>')

    const italian = await request.get('/it/feed.xml')
    expect(await italian.text()).toContain('<language>it</language>')
  })

  test('publishes an llms.txt with a licence statement', async ({ request }) => {
    const response = await request.get('/llms.txt')
    expect(response.status()).toBe(200)

    const body = await response.text()
    expect(body).toContain('## About')
    // A model that finds no licence has to assume the strictest one, so the
    // absence of one is stated rather than left silent.
    expect(body).toMatch(/> Licence:/)

    expect((await request.get('/llms-full.txt')).status()).toBe(200)
    expect((await request.get('/xx/llms.txt')).status()).toBe(404)
  })

  test('publishes the water points as open data', async ({ request }) => {
    const response = await request.get('/projects.json')
    expect(response.status()).toBe(200)
    expect(response.headers()['access-control-allow-origin']).toBe('*')

    const body = await response.json()
    expect(body).toHaveProperty('licence')
    expect(Array.isArray(body.projects)).toBe(true)
  })

  test('advertises the feed from every page', async ({ page }) => {
    await page.goto('/projects')
    await expect(
      page.locator('link[rel="alternate"][type="application/rss+xml"]'),
    ).toHaveAttribute('href', /\/feed\.xml$/)
  })
})
