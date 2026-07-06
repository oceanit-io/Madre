import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { env, requireAuth } from './helpers/env'

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/revendedora.json')

setup('autenticar revendedora de teste', async ({ page }) => {
  requireAuth()

  await page.goto('/auth/login')
  await page.waitForLoadState('domcontentloaded')

  await page.locator('input[type="email"]').fill(env.email)
  await page.locator('input[type="password"]').fill(env.password)
  await page.locator('button[type="submit"]').click()

  // Aguarda redirect para dashboard ou configurar-loja (depende do estado da conta)
  await page.waitForURL(/\/(dashboard|configurar-loja)/, { timeout: 20_000 })

  // Garante que não está na tela de erro
  const erroVisible = await page.getByText('E-mail ou senha incorretos.').isVisible()
  expect(erroVisible, 'Login falhou — verifique TEST_EMAIL e TEST_PASSWORD').toBe(false)

  await page.context().storageState({ path: AUTH_FILE })
  console.log(`[setup] storageState salvo em ${AUTH_FILE}`)
})
