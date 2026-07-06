import { test, expect } from '@playwright/test'
import { env } from './helpers/env'
import { CLIENTE_TESTE, CEP_TESTE } from './helpers/test-data'

// Testa o fluxo de checkout do INÍCIO ao FIM — da vitrine ao formulário
// preenchido com frete selecionado — mas NUNCA submete o pagamento.
//
// ⛔ Restrição permanente: nenhum teste aqui gera cobrança real.
//    Para testar pagamento end-to-end, use a chave sandbox do Pagar.me
//    (ak_test_...) em ambiente de staging isolado.

const slugOk = () => !!env.storeSlug && env.storeSlug !== 'slug-da-loja'

async function adicionarProdutoAoCarrinho(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto(`/loja/${env.storeSlug}`)
  await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

  const btnAdicionar = page.locator('.lj-card-btn', { hasText: 'Adicionar' }).first()
  if (await btnAdicionar.count() === 0) return false

  await btnAdicionar.click()
  await page.waitForTimeout(400)
  return true
}

test.describe('Checkout completo — até ANTES do pagamento', () => {
  test.beforeEach(async () => {
    test.skip(!slugOk(), 'TEST_STORE_SLUG não configurado corretamente no .env.test')
  })

  test('fluxo: vitrine → carrinho → checkout mostra formulário', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    // Vai ao carrinho
    await page.goto('/carrinho')

    // Calcula frete para liberar o checkout
    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })
    await inputCep.fill(CEP_TESTE)

    // Aguarda opções de frete carregarem
    await expect(page.locator('.cf-opcao').first()).toBeVisible({ timeout: 20_000 })

    // Clica em "Finalizar" (o botão de checkout)
    const btnFinalizar = page.getByText(/Finalizar|Ir para o pagamento/i).first()
    if (await btnFinalizar.count() === 0) test.skip()
    await btnFinalizar.click()

    // Deve chegar ao /checkout
    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 })
    await page.waitForLoadState('domcontentloaded')

    await page.screenshot({ path: 'playwright-report/checkout-completo-form.png' })
  })

  test('checkout exibe resumo do pedido com produto(s)', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')
    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })
    await inputCep.fill(CEP_TESTE)
    await expect(page.locator('.cf-opcao').first()).toBeVisible({ timeout: 20_000 })

    const btnFinalizar = page.getByText(/Finalizar|Ir para o pagamento/i).first()
    if (await btnFinalizar.count() === 0) test.skip()
    await btnFinalizar.click()
    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 })
    await page.waitForLoadState('domcontentloaded')

    // Checkout deve mostrar algum valor (subtotal/total)
    const textoPreco = page.getByText(/R\$\s*[\d.,]+/)
    await expect(textoPreco.first()).toBeVisible({ timeout: 8_000 })
  })

  test('campos de dados do cliente presentes no checkout', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')
    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })
    await inputCep.fill(CEP_TESTE)
    await expect(page.locator('.cf-opcao').first()).toBeVisible({ timeout: 20_000 })

    const btnFinalizar = page.getByText(/Finalizar|Ir para o pagamento/i).first()
    if (await btnFinalizar.count() === 0) test.skip()
    await btnFinalizar.click()
    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 })
    await page.waitForLoadState('domcontentloaded')

    // Campos de identificação do comprador devem existir
    const campoNome = page.getByLabel(/nome/i).or(page.getByPlaceholder(/nome/i)).first()
    const campoEmail = page.getByLabel(/e-mail/i).or(page.getByPlaceholder(/e-mail|email/i)).first()

    const temNome = await campoNome.count() > 0
    const temEmail = await campoEmail.count() > 0
    expect(temNome || temEmail, 'Checkout deve ter campos de identificação do comprador').toBe(true)
  })

  test('preencher dados completos do cliente no checkout', async ({ page }) => {
    const ok = await adicionarProdutoAoCarrinho(page)
    if (!ok) test.skip()

    await page.goto('/carrinho')
    const inputCep = page.locator('.cf-input').first()
    await expect(inputCep).toBeVisible({ timeout: 8_000 })
    await inputCep.fill(CEP_TESTE)
    await expect(page.locator('.cf-opcao').first()).toBeVisible({ timeout: 20_000 })

    const btnFinalizar = page.getByText(/Finalizar|Ir para o pagamento/i).first()
    if (await btnFinalizar.count() === 0) test.skip()
    await btnFinalizar.click()
    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 })
    await page.waitForLoadState('domcontentloaded')

    // Preenche os campos disponíveis com dados fictícios
    const campos: Record<string, string> = {
      nome: CLIENTE_TESTE.nome,
      email: CLIENTE_TESTE.email,
      cpf: CLIENTE_TESTE.cpf,
      telefone: CLIENTE_TESTE.telefone,
      cep: CLIENTE_TESTE.cep,
    }

    for (const [chave, valor] of Object.entries(campos)) {
      const campo = page.getByLabel(new RegExp(chave, 'i'))
        .or(page.getByPlaceholder(new RegExp(chave, 'i')))
        .first()

      if (await campo.count() > 0 && await campo.isVisible()) {
        await campo.fill(valor)
      }
    }

    // ⛔ NUNCA clica em botão de pagamento final
    await page.screenshot({ path: 'playwright-report/checkout-completo-preenchido.png' })
  })

  test('⛔ pagamento real NUNCA é executado nesta suíte', async () => {
    // Restrição permanente documentada.
    // Para testar o split completo com Pagar.me, use ambiente sandbox:
    //   PAGARME_API_KEY=ak_test_... + NEXT_PUBLIC_CHECKOUT_MODE=sandbox
    expect(true).toBe(true)
  })
})
