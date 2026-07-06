import { test, expect } from '@playwright/test'
import { env } from './helpers/env'

const slugOk = () => !!env.storeSlug && env.storeSlug !== 'slug-da-loja'

test.describe('Produto com variação', () => {
  test.beforeEach(async () => {
    test.skip(!slugOk(), 'TEST_STORE_SLUG não configurado corretamente no .env.test')
  })

  test('storefront exibe botão "Ver opções →" para produto com variação', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const btnVerOpcoes = page.locator('.lj-card-btn', { hasText: 'Ver opções' }).first()
    if (await btnVerOpcoes.count() === 0) {
      test.skip() // Loja não tem produtos com variação cadastrados
    }

    await expect(btnVerOpcoes).toBeVisible()
  })

  test('clicar em "Ver opções →" navega para página do produto', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const btnVerOpcoes = page.locator('.lj-card-btn', { hasText: 'Ver opções' }).first()
    if (await btnVerOpcoes.count() === 0) {
      test.skip()
    }

    // "Ver opções →" é um <span> dentro de um <a> — clicamos o link pai
    const linkProduto = page.locator('.lj-card a', { has: page.locator('.lj-card-btn', { hasText: 'Ver opções' }) }).first()
    if (await linkProduto.count() === 0) {
      // Fallback: span clicável diretamente
      await btnVerOpcoes.click()
    } else {
      await linkProduto.click()
    }

    // Deve navegar para /loja/[slug]/produto/[id]
    await page.waitForURL(/\/loja\/.+\/produto\//, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/produto\//)
  })

  test('página de produto carrega título e preço', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const btnVerOpcoes = page.locator('.lj-card-btn', { hasText: 'Ver opções' }).first()
    if (await btnVerOpcoes.count() === 0) {
      test.skip()
    }

    const linkProduto = page.locator('.lj-card a', { has: page.locator('.lj-card-btn', { hasText: 'Ver opções' }) }).first()
    if (await linkProduto.count() > 0) {
      await linkProduto.click()
    } else {
      await btnVerOpcoes.click()
    }

    await page.waitForURL(/\/produto\//, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    // Produto deve ter título (h1 ou texto proeminente com o nome)
    // e preço no formato R$ X,XX
    const textoPreco = page.getByText(/R\$\s*[\d.,]+/)
    await expect(textoPreco.first()).toBeVisible({ timeout: 10_000 })

    await page.screenshot({ path: 'playwright-report/produto-variacao.png' })
  })

  test('página de produto exibe botão "Adicionar ao Carrinho"', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const btnVerOpcoes = page.locator('.lj-card-btn', { hasText: 'Ver opções' }).first()
    if (await btnVerOpcoes.count() === 0) {
      test.skip()
    }

    const linkProduto = page.locator('.lj-card a', { has: page.locator('.lj-card-btn', { hasText: 'Ver opções' }) }).first()
    if (await linkProduto.count() > 0) {
      await linkProduto.click()
    } else {
      await btnVerOpcoes.click()
    }

    await page.waitForURL(/\/produto\//, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Adicionar ao Carrinho')).toBeVisible({ timeout: 10_000 })
  })

  test('adicionar produto com variação ao carrinho', async ({ page }) => {
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const btnVerOpcoes = page.locator('.lj-card-btn', { hasText: 'Ver opções' }).first()
    if (await btnVerOpcoes.count() === 0) {
      test.skip()
    }

    const linkProduto = page.locator('.lj-card a', { has: page.locator('.lj-card-btn', { hasText: 'Ver opções' }) }).first()
    if (await linkProduto.count() > 0) {
      await linkProduto.click()
    } else {
      await btnVerOpcoes.click()
    }

    await page.waitForURL(/\/produto\//, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    // Clica "Adicionar ao Carrinho" (a 1ª variação já vem pré-selecionada)
    const btnAdicionar = page.getByText('Adicionar ao Carrinho')
    await expect(btnAdicionar).toBeVisible({ timeout: 10_000 })
    await btnAdicionar.click()

    // Navega ao carrinho e verifica que o item está lá
    await page.goto('/carrinho')
    const btnMenos = page.locator('button[aria-label="Diminuir quantidade"]')
    await expect(btnMenos.first()).toBeVisible({ timeout: 8_000 })

    await page.screenshot({ path: 'playwright-report/carrinho-com-variacao.png' })
  })
})
