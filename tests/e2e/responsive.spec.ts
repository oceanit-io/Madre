import { test, expect } from '@playwright/test'
import path from 'path'
import { env } from './helpers/env'

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/revendedora.json')

// Viewport mobile padrão (Pixel 5 via playwright.config.ts project "mobile")
// Mas também pode ser rodado isolado com o viewport abaixo:
test.use({ viewport: { width: 393, height: 851 } })

test.describe('Responsividade Mobile', () => {
  async function semOverflowHorizontal(page: import('@playwright/test').Page): Promise<boolean> {
    return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
  }

  test('login — sem overflow horizontal', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('domcontentloaded')

    expect(await semOverflowHorizontal(page)).toBe(true)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await page.screenshot({ path: 'playwright-report/mobile-login.png' })
  })

  test('login — campos e botão com tamanho tappable (≥44px)', async ({ page }) => {
    await page.goto('/auth/login')
    const btn = page.locator('button[type="submit"]')
    const box = await btn.boundingBox()
    expect(box?.height, 'Botão de submit deve ter pelo menos 44px de altura').toBeGreaterThanOrEqual(44)
  })

  test('loja pública — sem overflow horizontal', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    expect(await semOverflowHorizontal(page)).toBe(true)
    await page.screenshot({ path: 'playwright-report/mobile-loja.png' })
  })

  test('loja pública — header fixo no topo em mobile', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    // Rola para baixo e verifica que o header ainda está visível
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(300)
    await expect(page.locator('.lj-hdr')).toBeVisible()
  })

  test('carrinho — sem overflow horizontal', async ({ page }) => {
    await page.goto('/carrinho')
    await page.waitForLoadState('domcontentloaded')
    expect(await semOverflowHorizontal(page)).toBe(true)
    await page.screenshot({ path: 'playwright-report/mobile-carrinho.png' })
  })

  test('dashboard — BottomNav fixo em mobile', async ({ browser }) => {
    test.skip(!process.env.TEST_EMAIL, 'Requer autenticação')

    // Cria contexto próprio com storageState (não pode setar via page após criação)
    const context = await browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 393, height: 851 },
    })
    const page = await context.newPage()

    try {
      await page.goto('/dashboard')
      // Aguarda o spinner sumir (auth check + redirect ou render completo)
      await expect(page.getByText('Carregando sua loja...')).toBeHidden({ timeout: 20_000 })

      // Conta pode redirecionar para /configurar-loja — BottomNav existe lá também
      // Verificamos em qualquer uma das páginas autenticadas
      const url = page.url()
      if (url.includes('/auth/login')) {
        test.skip() // storageState expirado
      }

      // BottomNav usa position:fixed — checar <nav> interno, não o wrapper zero-height
      const nav = page.locator('[data-tour="bottom-nav"] nav')
      await expect(nav).toBeAttached({ timeout: 10_000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true)
      await page.screenshot({ path: 'playwright-report/mobile-dashboard.png' })
    } finally {
      await context.close()
    }
  })
})
