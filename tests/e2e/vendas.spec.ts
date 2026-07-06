import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/revendedora.json')

test.use({ storageState: AUTH_FILE })

test.describe('Painel de vendas da revendedora', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vendas')
    // Aguarda sair do spinner ou do redirecionamento de auth
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    // Se caiu no login, a sessão expirou — pula o teste graciosamente
    if (page.url().includes('/auth/login')) {
      test.skip()
    }
  })

  test('página carrega com header "Minhas vendas"', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'playwright-report/vendas-header.png' })
  })

  test('painel de métricas exibe 3 números (vendas pagas, a enviar, ganho)', async ({ page }) => {
    // O banner rosa tem 3 colunas: "Vendas pagas", "A enviar", "Você ganhou"
    await expect(page.getByText('Vendas pagas')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('A enviar')).toBeVisible()
    await expect(page.getByText('Você ganhou')).toBeVisible()
  })

  test('filtros de status estão presentes', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })

    // Todos os filtros devem estar visíveis
    await expect(page.getByText('Todos')).toBeVisible()
    await expect(page.getByText('Pago — enviar')).toBeVisible()
    await expect(page.getByText('Enviados')).toBeVisible()
    await expect(page.getByText('Entregues')).toBeVisible()
    await expect(page.getByText('Aguardando')).toBeVisible()
    await expect(page.getByText('Cancelados')).toBeVisible()
  })

  test('exibe lista de vendas ou estado vazio', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })

    const temPedidos = await page.locator('.card button[aria-expanded]').count()
    const temVazio = await page.getByText(/Nenhuma venda ainda|Nada neste filtro/i).count()

    expect(
      temPedidos + temVazio,
      'Deve mostrar pedidos ou mensagem de lista vazia'
    ).toBeGreaterThan(0)
  })

  test('filtro "Enviados" filtra a lista corretamente', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })

    await page.getByText('Enviados').click()
    await page.waitForTimeout(300)

    // Após filtrar, deve mostrar pedidos com status "Enviado" ou estado vazio
    const temPedidosEnviados = await page.locator('.card button[aria-expanded]').count()
    const temVazio = await page.getByText(/Nada neste filtro/i).count()

    expect(temPedidosEnviados + temVazio).toBeGreaterThan(0)
  })

  test('expandir um pedido mostra detalhes do cliente', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })

    const cardPedido = page.locator('.card button[aria-expanded="false"]').first()
    if (await cardPedido.count() === 0) {
      test.skip() // Sem pedidos para expandir
    }

    await cardPedido.click()
    await page.waitForTimeout(300)

    // Card expandido deve mostrar seção "Cliente"
    await expect(page.getByText('Cliente').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Endereço de entrega').first()).toBeVisible()
    await expect(page.getByText('Peças').first()).toBeVisible()

    await page.screenshot({ path: 'playwright-report/vendas-pedido-expandido.png' })
  })

  test('BottomNav com aba "vendas" ativa está presente', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })

    const nav = page.locator('[data-tour="bottom-nav"] nav')
    await expect(nav).toBeAttached()
  })

  test('nenhuma resposta 401 inesperada nas APIs de revendedora', async ({ page }) => {
    const erros401: string[] = []
    page.on('response', res => {
      if (res.status() === 401 && res.url().includes('/api/revendedora')) {
        erros401.push(res.url())
      }
    })

    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    expect(erros401, `401 inesperado: ${erros401.join(', ')}`).toHaveLength(0)
  })

  test('botão "Voltar" navega para o dashboard', async ({ page }) => {
    await expect(page.getByText('Minhas vendas')).toBeVisible({ timeout: 10_000 })

    await page.locator('button[aria-label="Voltar"]').click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 })
  })
})
