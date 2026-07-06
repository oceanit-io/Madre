import { test, expect } from '@playwright/test'
import { env } from './helpers/env'

const slugOk = () => !!env.storeSlug && env.storeSlug !== 'slug-da-loja'

test.describe('Loja pública', () => {
  test.beforeEach(async () => {
    test.skip(!slugOk(), 'TEST_STORE_SLUG não configurado corretamente no .env.test')
  })

  test('loja carrega e não fica presa em spinner', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    await expect(page.locator('.lj-hdr')).toBeVisible()
  })

  test('hero/banner é exibido', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    await expect(page.locator('.lj-hero')).toBeVisible()
  })

  test('barra de confiança exibe os 3 selos', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    await expect(page.locator('strong').filter({ hasText: /^Prata 925$/ }).first()).toBeVisible()
    await expect(page.getByText(/todo.*Brasil/i).first()).toBeVisible()
    await expect(page.getByText(/sem juros/i).first()).toBeVisible()
  })

  test('abre e fecha o drawer de categorias', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    await page.locator('button[aria-label="Abrir menu"]').click()
    await expect(page.locator('[role="dialog"][aria-label="Menu da loja"]')).toBeVisible()

    await page.locator('button[aria-label="Fechar menu"]').click()
    await expect(page.locator('[role="dialog"]')).toBeHidden()
  })

  test('campo de busca existe e aceita texto', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const busca = page.getByPlaceholder('Buscar joia...')
    await expect(busca).toBeVisible()
    await busca.fill('anel')
    await expect(busca).toHaveValue('anel')
  })

  test('grid de produtos ou estado vazio renderiza', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const temProdutos = await page.locator('.lj-card').count()
    const temVazio = await page.getByText('Em breve novas peças nesta loja.').count()
    expect(temProdutos + temVazio, 'Deve exibir produtos ou mensagem de ausência').toBeGreaterThan(0)
  })

  test('produto tem botão de ação visível', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const qtProdutos = await page.locator('.lj-card').count()
    if (qtProdutos === 0) {
      test.skip()
    }
    await expect(page.locator('.lj-card-btn').first()).toBeVisible()
  })

  test('loja inexistente exibe "Loja não encontrada"', async ({ page }) => {
    await page.goto('/loja/loja-que-nao-existe-e2e-99999')
    await expect(page.getByText('Loja não encontrada')).toBeVisible({ timeout: 12_000 })
  })

  test('footer visível com scroll até o fim', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('footer')).toBeVisible()
    await expect(page.locator('footer').getByText('© Prata 925')).toBeVisible()
  })

  test('screenshot da vitrine para evidência', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    await page.screenshot({ path: 'playwright-report/storefront.png', fullPage: false })
  })
})
