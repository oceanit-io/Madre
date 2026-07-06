import { test, expect } from '@playwright/test'
import { env } from './helpers/env'
import { CEP_TESTE } from './helpers/test-data'

const slugOk = () => !!env.storeSlug && env.storeSlug !== 'slug-da-loja'

// Garante que há um produto no carrinho antes de cada teste de frete.
// Retorna false se não houver produto disponível (teste deve ser pulado).
async function adicionarProdutoAoCarrinho(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto(`/loja/${env.storeSlug}`)
  await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

  const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
  if (await btnAdicionar.count() === 0) return false

  await btnAdicionar.click()
  await page.waitForTimeout(400)
  return true
}

test.describe('Calculadora de frete — integração real', () => {
  test.beforeEach(async () => {
    test.skip(!slugOk(), 'TEST_STORE_SLUG não configurado corretamente no .env.test')
  })

  test('campo de CEP existe e aceita entrada', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')

    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })

    // Deve aplicar máscara ao digitar (ex: 01310-100)
    await inputCep.fill(CEP_TESTE)
    const valorComMascara = await inputCep.inputValue()
    // Aceita com ou sem hífen (máscara automática)
    expect(valorComMascara.replace(/\D/g, '')).toBe('01310100')
  })

  test('CEP válido → exibe opções PAC e/ou SEDEX com prazo', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')

    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })

    // CalculadoraFrete auto-calcula ao completar 8 dígitos
    await inputCep.fill(CEP_TESTE)

    // Aguarda opções aparecerem (chama APIs de CEP + frete)
    const opcaoPAC = page.locator('.cf-opcao-nome', { hasText: 'PAC' }).first()
    const opcaoSEDEX = page.locator('.cf-opcao-nome', { hasText: 'SEDEX' }).first()

    await expect(opcaoPAC.or(opcaoSEDEX)).toBeVisible({ timeout: 20_000 })

    await page.screenshot({ path: 'playwright-report/frete-opcoes.png' })
  })

  test('opção de frete exibe prazo em dias úteis', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')

    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })
    await inputCep.fill(CEP_TESTE)

    // Aguarda ao menos uma opção
    await expect(page.locator('.cf-opcao').first()).toBeVisible({ timeout: 20_000 })

    // Deve mostrar prazo em dias úteis
    await expect(page.getByText(/dias úteis/i).first()).toBeVisible()
  })

  test('opção de frete exibe valor em R$ ou "Grátis"', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')

    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })
    await inputCep.fill(CEP_TESTE)

    await expect(page.locator('.cf-opcao').first()).toBeVisible({ timeout: 20_000 })

    // Ao menos uma opção deve mostrar preço (R$X,XX) ou "Grátis"
    const precoOuGratis = page.locator('.cf-opcao-preco').first()
    await expect(precoOuGratis).toBeVisible()
    const texto = await precoOuGratis.textContent()
    const temPreco = /R\$/.test(texto || '') || /[Gg]r[aá]tis/.test(texto || '')
    expect(temPreco, `Preço do frete inválido: "${texto}"`).toBe(true)
  })

  test('CEP inválido → exibe mensagem de erro', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')

    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })

    // CEP fictício inválido
    await inputCep.fill('99999-999')

    // Deve mostrar erro (CEP não encontrado)
    await expect(
      page.getByText(/CEP não encontrado|CEP inválido|Não foi possível/i).first()
    ).toBeVisible({ timeout: 15_000 })
  })
})
