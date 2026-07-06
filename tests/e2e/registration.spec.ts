import { test, expect } from '@playwright/test'

// Dados fictícios usados no cadastro — não chegam a criar conta real
// porque o teste interrompe ANTES do submit final do passo 2.
const REGISTRO_TESTE = {
  nome: 'Teste E2E Revendedora',
  email: `e2e.reg.${Date.now()}@example.com`,
  whatsapp: '(11) 98765-4321',
  cidade: 'São Paulo',
  estado: 'SP',
  senha: 'E2eTeste@925',
}

test.describe('Cadastro de revendedora — formulário multi-etapa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register')
    await page.waitForLoadState('domcontentloaded')
  })

  test('página carrega e exibe indicador passo 1 de 2', async ({ page }) => {
    await expect(page.getByText(/passo 1 de 2/i)).toBeVisible()
    await expect(page.getByText(/Crie sua loja/i)).toBeVisible()
    await page.screenshot({ path: 'playwright-report/register-step1.png' })
  })

  test('passo 1 — todos os campos obrigatórios estão presentes', async ({ page }) => {
    await expect(page.getByPlaceholder('Seu nome completo')).toBeVisible()
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible()
    await expect(page.getByPlaceholder('(11) 99999-9999')).toBeVisible()
    await expect(page.getByPlaceholder('São Paulo')).toBeVisible()
    await expect(page.getByPlaceholder('SP')).toBeVisible()
    await expect(page.getByPlaceholder(/conte um pouco/i)).toBeVisible()
  })

  test('submit sem preencher passo 1 → não avança (validação HTML5)', async ({ page }) => {
    await page.getByText('Continuar →').click()
    // Deve continuar em /auth/register com "Passo 1 de 2"
    await expect(page.getByText(/passo 1 de 2/i)).toBeVisible()
  })

  test('link "Já tem conta?" navega para login', async ({ page }) => {
    await page.getByText('Entrar').click()
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('preencher passo 1 completo → avança para passo 2', async ({ page }) => {
    await page.getByPlaceholder('Seu nome completo').fill(REGISTRO_TESTE.nome)
    await page.getByPlaceholder('seu@email.com').fill(REGISTRO_TESTE.email)
    await page.getByPlaceholder('(11) 99999-9999').fill(REGISTRO_TESTE.whatsapp)
    await page.getByPlaceholder('São Paulo').fill(REGISTRO_TESTE.cidade)
    await page.getByPlaceholder('SP').fill(REGISTRO_TESTE.estado)

    await page.getByText('Continuar →').click()

    await expect(page.getByText(/passo 2 de 2/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/Crie sua senha/i)).toBeVisible()
    await page.screenshot({ path: 'playwright-report/register-step2.png' })
  })

  test('passo 2 — preview do link da loja é exibido', async ({ page }) => {
    await page.getByPlaceholder('Seu nome completo').fill(REGISTRO_TESTE.nome)
    await page.getByPlaceholder('seu@email.com').fill(REGISTRO_TESTE.email)
    await page.getByPlaceholder('(11) 99999-9999').fill(REGISTRO_TESTE.whatsapp)
    await page.getByPlaceholder('São Paulo').fill(REGISTRO_TESTE.cidade)
    await page.getByPlaceholder('SP').fill(REGISTRO_TESTE.estado)
    await page.getByText('Continuar →').click()
    await expect(page.getByText(/passo 2 de 2/i)).toBeVisible({ timeout: 5_000 })

    // Mostra "Seu link da loja será:" com domínio
    await expect(page.getByText(/Seu link da loja será/i)).toBeVisible()
    await expect(page.getByText(/lojadeprata925\.com\.br/i)).toBeVisible()
  })

  test('passo 2 — botão "Criar minha loja" desabilitado sem aceitar termos', async ({ page }) => {
    await page.getByPlaceholder('Seu nome completo').fill(REGISTRO_TESTE.nome)
    await page.getByPlaceholder('seu@email.com').fill(REGISTRO_TESTE.email)
    await page.getByPlaceholder('(11) 99999-9999').fill(REGISTRO_TESTE.whatsapp)
    await page.getByPlaceholder('São Paulo').fill(REGISTRO_TESTE.cidade)
    await page.getByPlaceholder('SP').fill(REGISTRO_TESTE.estado)
    await page.getByText('Continuar →').click()
    await expect(page.getByText(/passo 2 de 2/i)).toBeVisible({ timeout: 5_000 })

    const senhaInputs = page.locator('input[type="password"]')
    await senhaInputs.first().fill(REGISTRO_TESTE.senha)
    await senhaInputs.last().fill(REGISTRO_TESTE.senha)

    // Termos NÃO foram aceitos → botão desabilitado
    const btnCriar = page.getByText(/Criar minha loja/i)
    await expect(btnCriar).toBeDisabled()
  })

  test('passo 2 — senhas diferentes → botão permanece desabilitado', async ({ page }) => {
    await page.getByPlaceholder('Seu nome completo').fill(REGISTRO_TESTE.nome)
    await page.getByPlaceholder('seu@email.com').fill(REGISTRO_TESTE.email)
    await page.getByPlaceholder('(11) 99999-9999').fill(REGISTRO_TESTE.whatsapp)
    await page.getByPlaceholder('São Paulo').fill(REGISTRO_TESTE.cidade)
    await page.getByPlaceholder('SP').fill(REGISTRO_TESTE.estado)
    await page.getByText('Continuar →').click()
    await expect(page.getByText(/passo 2 de 2/i)).toBeVisible({ timeout: 5_000 })

    const senhaInputs = page.locator('input[type="password"]')
    await senhaInputs.first().fill(REGISTRO_TESTE.senha)
    await senhaInputs.last().fill('senhadiferente999')

    // Aceita os termos
    await page.locator('input[type="checkbox"]').check()

    const btnCriar = page.getByText(/Criar minha loja/i)
    await expect(btnCriar).toBeDisabled()
  })

  test('passo 2 — botão "Voltar" retorna ao passo 1', async ({ page }) => {
    await page.getByPlaceholder('Seu nome completo').fill(REGISTRO_TESTE.nome)
    await page.getByPlaceholder('seu@email.com').fill(REGISTRO_TESTE.email)
    await page.getByPlaceholder('(11) 99999-9999').fill(REGISTRO_TESTE.whatsapp)
    await page.getByPlaceholder('São Paulo').fill(REGISTRO_TESTE.cidade)
    await page.getByPlaceholder('SP').fill(REGISTRO_TESTE.estado)
    await page.getByText('Continuar →').click()
    await expect(page.getByText(/passo 2 de 2/i)).toBeVisible({ timeout: 5_000 })

    await page.getByText('← Voltar').click()
    await expect(page.getByText(/passo 1 de 2/i)).toBeVisible()
    // Dados do passo 1 ainda devem estar preenchidos
    await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue(REGISTRO_TESTE.nome)
  })
})
