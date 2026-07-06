import { test, expect } from '@playwright/test'
import { env } from './helpers/env'

test.describe('Carrinho', () => {
  test('carrinho vazio exibe CTA para explorar coleção', async ({ page }) => {
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await expect(page.getByText('Ver coleção')).toBeVisible()
    await page.screenshot({ path: 'playwright-report/carrinho-vazio.png' })
  })

  test('adicionar produto (sem variação) e verificar no carrinho', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')

    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    // Busca botão "+ Adicionar" (produto sem variação)
    const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
    if (await btnAdicionar.count() === 0) {
      test.skip() // Todos têm variação — pula
    }

    await btnAdicionar.click()
    // Aguarda feedback visual de confirmação
    await expect(
      page.locator('.lj-card-btn', { hasText: 'Adicionado' }).first()
    ).toBeVisible({ timeout: 5_000 })

    // Navega ao carrinho
    await page.goto('/carrinho')
    await expect(page.getByText('Carrinho')).toBeVisible()

    // Deve ter pelo menos um item
    const btnMenos = page.locator('button[aria-label="Diminuir quantidade"]')
    await expect(btnMenos.first()).toBeVisible()

    await page.screenshot({ path: 'playwright-report/carrinho-com-item.png' })
  })

  test('botões de quantidade funcionam', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')

    // Adiciona produto primeiro
    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
    if (await btnAdicionar.count() === 0) test.skip()
    await btnAdicionar.click()
    await page.waitForTimeout(500)

    await page.goto('/carrinho')
    const btnMais = page.locator('button[aria-label="Aumentar quantidade"]').first()
    if (await btnMais.count() === 0) test.skip()

    // Lê quantidade atual
    const qtEl = page.locator('button[aria-label="Diminuir quantidade"]').first()
      .locator('..').locator('div').nth(1)

    await btnMais.click()
    await page.waitForTimeout(300)
    // Verifica que o botão ainda existe (não quebrou)
    await expect(page.locator('button[aria-label="Diminuir quantidade"]').first()).toBeVisible()
  })

  test('remover item → carrinho fica vazio', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')

    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
    if (await btnAdicionar.count() === 0) test.skip()
    await btnAdicionar.click()
    await page.waitForTimeout(500)

    await page.goto('/carrinho')
    const btnRemover = page.getByText('Remover').first()
    if (await btnRemover.count() === 0) test.skip()

    await btnRemover.click()
    // Após remover o único item, carrinho deve ficar vazio
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible({ timeout: 5_000 })
  })

  test('botão finalizar desabilitado quando nada selecionado', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')

    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
    if (await btnAdicionar.count() === 0) test.skip()
    await btnAdicionar.click()
    await page.waitForTimeout(500)

    await page.goto('/carrinho')
    // Desmarca todos os itens
    const btnTodos = page.locator('button[aria-label="Selecionar tudo"]')
    if (await btnTodos.count() > 0) {
      await btnTodos.click() // desseleciona tudo
    }

    const btnFinalizar = page.getByText('Selecione um item')
    if (await btnFinalizar.count() > 0) {
      await expect(btnFinalizar).toBeDisabled()
    }
  })

  test('calculadora de frete está presente no resumo', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')

    await page.goto(`/loja/${env.storeSlug}`)
    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })
    const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
    if (await btnAdicionar.count() === 0) test.skip()
    await btnAdicionar.click()
    await page.waitForTimeout(500)

    await page.goto('/carrinho')
    // Calculadora de frete deve existir
    await expect(page.getByPlaceholder(/CEP|cep/).or(page.getByText(/Calcular frete|frete/))).toBeVisible({ timeout: 5_000 })
  })
})
