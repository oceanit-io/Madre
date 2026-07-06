import { test, expect } from '@playwright/test'
import { env, requireAuth } from './helpers/env'

test.describe('Login — fluxo e segurança', () => {
  test('login com credenciais válidas → redireciona para área autenticada', async ({ page }) => {
    requireAuth()
    await page.goto('/auth/login')

    await page.locator('input[type="email"]').fill(env.email)
    await page.locator('input[type="password"]').fill(env.password)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/(dashboard|configurar-loja)/, { timeout: 20_000 })
    await expect(page.getByText('E-mail ou senha incorretos.')).not.toBeVisible()
  })

  test('login com senha errada → exibe mensagem de erro', async ({ page }) => {
    requireAuth()
    await page.goto('/auth/login')

    await page.locator('input[type="email"]').fill(env.email)
    await page.locator('input[type="password"]').fill('senha_errada_e2e_99999')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('submit sem preencher campos → não avança (validação HTML5)', async ({ page }) => {
    await page.goto('/auth/login')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('link "Esqueci a senha" navega corretamente', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('Esqueci a senha').click()
    await expect(page).toHaveURL(/\/auth\/esqueci-senha/)
  })

  test('link "Cadastre-se" navega para registro', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('Cadastre-se').click()
    await expect(page).toHaveURL(/\/auth\/register/)
  })
})

test.describe('Proteção de rotas — sem login', () => {
  const ROTAS_PROTEGIDAS = [
    '/dashboard',
    '/vendas',
    '/saldo',
    '/perfil',
    '/configurar-loja',
    '/minha-loja',
  ]

  for (const rota of ROTAS_PROTEGIDAS) {
    test(`${rota} sem sessão → redireciona para login`, async ({ page }) => {
      await page.goto(rota)
      await page.waitForURL(/\/auth\/login/, { timeout: 10_000 })
      await expect(page).toHaveURL(/\/auth\/login/)
    })
  }
})
