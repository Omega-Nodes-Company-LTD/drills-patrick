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
