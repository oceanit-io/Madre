import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/revendedora.json')

test.use({ storageState: AUTH_FILE })

test.describe('Configurar loja — personalização', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/configurar-loja')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    if (page.url().includes('/auth/login')) {
      test.skip()
    }

    // Aguarda o spinner de carregamento sumir
    await expect(page.getByText('Carregando...')).toBeHidden({ timeout: 15_000 })
  })

  test('página carrega e exibe campo de nome da loja', async ({ page }) => {
    // Campo nome da loja — label ou placeholder
    const campoNome = page.getByLabel(/nome da loja/i)
      .or(page.getByPlaceholder(/nome da loja/i))
      .first()

    await expect(campoNome).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'playwright-report/configurar-loja.png' })
  })

  test('seletor de cor/tema está presente', async ({ page }) => {
    // O seletor de tema usa botões coloridos — verificamos que existem na página
    const campoNome = page.getByLabel(/nome da loja/i)
      .or(page.getByPlaceholder(/nome da loja/i))
      .first()
    await expect(campoNome).toBeVisible({ timeout: 10_000 })

    // Deve existir botão de cor (círculos de tema)
    const botoesCor = page.locator('button[title]').filter({ hasText: '' })
    const temSelector = await botoesCor.count() > 0 ||
      await page.getByText(/cor|tema|aparência/i).count() > 0

    expect(temSelector, 'Deve existir seletor de cor ou tema').toBe(true)
  })

  test('campo de nome da loja aceita edição', async ({ page }) => {
    const campoNome = page.getByLabel(/nome da loja/i)
      .or(page.getByPlaceholder(/nome da loja/i))
      .first()
    await expect(campoNome).toBeVisible({ timeout: 10_000 })

    const nomeAtual = await campoNome.inputValue()
    const nomeNovo = nomeAtual ? `${nomeAtual} Teste` : 'Minha Loja Teste'

    await campoNome.fill(nomeNovo)
    await expect(campoNome).toHaveValue(nomeNovo)

    // Desfaz a edição (não salva)
    await campoNome.fill(nomeAtual)
  })

  test('botão de salvar está presente na página', async ({ page }) => {
    const campoNome = page.getByLabel(/nome da loja/i)
      .or(page.getByPlaceholder(/nome da loja/i))
      .first()
    await expect(campoNome).toBeVisible({ timeout: 10_000 })

    const btnSalvar = page.getByText(/Salvar|salvar|Atualizar/i).first()
    await expect(btnSalvar).toBeVisible()
  })

  test('link de preview da loja está visível', async ({ page }) => {
    const campoNome = page.getByLabel(/nome da loja/i)
      .or(page.getByPlaceholder(/nome da loja/i))
      .first()
    await expect(campoNome).toBeVisible({ timeout: 10_000 })

    // A URL editável da loja (/loja/[slug]) deve aparecer na página
    const textoSlug = page.getByText(/\/loja\//i).or(page.getByText(/lojadeprata925\.com\.br/i)).first()
    await expect(textoSlug).toBeVisible()
  })

  test('BottomNav presente na página de configuração', async ({ page }) => {
    await expect(
      page.getByLabel(/nome da loja/i).or(page.getByPlaceholder(/nome da loja/i)).first()
    ).toBeVisible({ timeout: 10_000 })

    const nav = page.locator('[data-tour="bottom-nav"] nav')
    await expect(nav).toBeAttached()
  })

  test('nenhuma resposta 401 inesperada ao carregar a página', async ({ page }) => {
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
})
