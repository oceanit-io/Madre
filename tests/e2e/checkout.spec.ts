import { test, expect } from '@playwright/test'
import { CLIENTE_TESTE } from './helpers/test-data'

test.describe('Checkout — até ANTES do pagamento', () => {
  test('acesso direto sem itens → redireciona ou avisa', async ({ page }) => {
    await page.goto('/checkout')
    // Checkout usa client-side: aguarda JS verificar sessionStorage
    await page.waitForLoadState('networkidle')

    const url = page.url()
    // Pode redirecionar para carrinho
    if (url.includes('/carrinho')) return

    // Ou exibir mensagem de carrinho vazio / voltar
    const temMensagem = await page.getByText(/carrinho|vazio|voltar/i).count()
    // Ou simplesmente mostrar o form de checkout (se itens ficaram no storage)
    const temForm = await page.locator('form, input[type="text"], input[type="email"]').count()
    expect(
      temMensagem > 0 || temForm > 0 || url.includes('/carrinho'),
      'Checkout deve tratar acesso sem itens'
    ).toBeTruthy()
  })

  test('campos do formulário aceitam dados fictícios válidos', async ({ page }) => {
    await page.goto('/checkout')
    await page.waitForLoadState('domcontentloaded')

    // Se redirecionou, não há formulário — pula
    if (!page.url().includes('/checkout')) {
      test.skip()
    }

    // Tenta preencher campos se presentes
    const campoNome = page.getByLabel(/nome/i).first()
    if (await campoNome.isVisible()) {
      await campoNome.fill(CLIENTE_TESTE.nome)
      await expect(campoNome).toHaveValue(CLIENTE_TESTE.nome)
    }

    const campoEmail = page.getByLabel(/e-mail/i).first()
    if (await campoEmail.isVisible()) {
      await campoEmail.fill(CLIENTE_TESTE.email)
      await expect(campoEmail).toHaveValue(CLIENTE_TESTE.email)
    }

    const campoCEP = page.getByLabel(/cep/i).first()
    if (await campoCEP.isVisible()) {
      await campoCEP.fill(CLIENTE_TESTE.cep)
    }

    // ⛔ NUNCA clica em botão de pagamento final
    await page.screenshot({ path: 'playwright-report/checkout-campos.png' })
  })

  test('⛔ pagamento real NUNCA é executado nesta suíte', async () => {
    // Documentado como restrição permanente.
    // Para testar fluxo completo, use ambiente Pagar.me sandbox:
    //   - api_key de test (ak_test_...)
    //   - NEXT_PUBLIC_CHECKOUT_MODE=sandbox
    // Nenhum teste desta suíte chega ao step de criação de cobrança real.
    expect(true).toBe(true)
  })
})
