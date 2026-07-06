import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/revendedora.json')

test.use({ storageState: AUTH_FILE })

test.describe('Dashboard da revendedora', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    // Aguarda sair do spinner inicial
    await expect(page.getByText('Carregando sua loja...')).toBeHidden({ timeout: 20_000 })

    // Se a conta redirecionou para /configurar-loja (conta ativa não personalizada),
    // pula o teste com mensagem clara em vez de falhar nos seletores do dashboard.
    const url = page.url()
    if (!url.includes('/dashboard')) {
      test.skip()
    }
  })

  test('painel carrega — card de saldo visível', async ({ page }) => {
    await expect(page.locator('[data-tour="saldo"]')).toBeVisible()
  })

  test('resumo do mês com métricas visível', async ({ page }) => {
    await expect(page.locator('[data-tour="resumo"]')).toBeVisible()
    const cards = page.locator('[data-tour="resumo"] .card')
    await expect(cards).toHaveCount(4)
  })

  test('card de link da loja exibe botão "Copiar link"', async ({ page }) => {
    const cardLoja = page.locator('[data-tour="link-loja"]')
    await expect(cardLoja).toBeVisible()
    await expect(cardLoja.getByText('Copiar link')).toBeVisible()
    await expect(cardLoja.getByText('Ver minha loja')).toBeVisible()
  })

  test('seção de últimas comissões renderiza (lista ou estado vazio)', async ({ page }) => {
    const secao = page.locator('[data-tour="comissoes"]')
    await expect(secao).toBeVisible()

    const temComissoes = await secao.locator('.card').count()
    const temEstadoVazio = await secao.getByText('Sua primeira venda está logo ali!').count()
    expect(temComissoes + temEstadoVazio).toBeGreaterThan(0)
  })

  test('BottomNav fixo existe e tem abas de navegação', async ({ page }) => {
    // O BottomNav usa position:fixed — o wrapper <div data-tour="bottom-nav"> tem altura zero.
    // Checamos o <nav> de dentro que é o elemento fixo visível na tela.
    const nav = page.locator('[data-tour="bottom-nav"] nav')
    await expect(nav).toBeAttached()

    // Deve ter 5 abas: Início, Vendas, Minha loja, Saldo, Perfil
    const abas = nav.locator('div[style*="cursor: pointer"]')
    await expect(abas).toHaveCount(5)
  })

  test('botão "Sacar" está presente no card de saldo', async ({ page }) => {
    // O texto "Sacar" fica dentro de um button com PixLogo (SVG) ao lado.
    // Usamos filter para encontrar o button que contém "Sacar" no texto.
    const btnSacar = page.locator('[data-tour="saldo"] button').filter({ hasText: /Sacar/i })
    await expect(btnSacar.first()).toBeAttached()
  })

  test('nenhuma resposta 401 inesperada nas chamadas de revendedora', async ({ page }) => {
    const erros401: string[] = []
    page.on('response', res => {
      if (res.status() === 401 && res.url().includes('/api/revendedora')) {
        erros401.push(res.url())
      }
    })
    await page.reload()
    await expect(page.getByText('Carregando sua loja...')).toBeHidden({ timeout: 20_000 })
    expect(erros401, `401 inesperado nas APIs: ${erros401.join(', ')}`).toHaveLength(0)
  })

  test('screenshot do painel para evidência', async ({ page }) => {
    await page.screenshot({ path: 'playwright-report/dashboard.png', fullPage: false })
  })
})
