import { test, expect } from '@playwright/test'
import { env } from './helpers/env'

const ROTAS_PUBLICAS = [
  { url: '/landing', nome: 'Landing' },
  { url: '/auth/login', nome: 'Login' },
  { url: '/auth/register', nome: 'Registro' },
  { url: '/auth/esqueci-senha', nome: 'Esqueci senha' },
]

test.describe('Smoke — Rotas públicas', () => {
  for (const rota of ROTAS_PUBLICAS) {
    test(`${rota.nome} carrega sem erro 500`, async ({ page }) => {
      const erros: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') erros.push(`[console.error] ${msg.text()}`)
      })
      page.on('response', res => {
        if (res.status() >= 500) erros.push(`[HTTP ${res.status()}] ${res.url()}`)
      })

      const res = await page.goto(rota.url)
      await page.waitForLoadState('domcontentloaded')

      expect(res?.status(), `Rota ${rota.url} retornou erro`).toBeLessThan(500)

      const errosCriticos = erros.filter(e =>
        !e.includes('extension') &&
        !e.includes('chrome-extension') &&
        !e.includes('favicon')
      )
      if (errosCriticos.length > 0) {
        console.warn(`Avisos em ${rota.url}:`, errosCriticos)
      }
    })
  }

  test('raiz redireciona ou renderiza conteúdo', async ({ page }) => {
    const res = await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(res?.status()).toBeLessThan(500)
    const bodyText = await page.evaluate(() => document.body.innerText.trim())
    expect(bodyText.length).toBeGreaterThan(10)
  })

  test('loja pública carrega se TEST_STORE_SLUG configurado', async ({ page }) => {
    test.skip(!env.storeSlug || env.storeSlug === 'slug-da-loja', 'TEST_STORE_SLUG não configurado')

    const res = await page.goto(`/loja/${env.storeSlug}`)
    expect(res?.status()).toBeLessThan(500)

    await expect(page.getByText('Carregando loja...')).toBeHidden({ timeout: 12_000 })

    const temHeader = await page.locator('.lj-hdr').count()
    const temNaoEncontrada = await page.getByText('Loja não encontrada').count()
    expect(temHeader + temNaoEncontrada, 'Loja deve exibir header ou mensagem de não encontrada').toBeGreaterThan(0)

    await page.screenshot({ path: 'playwright-report/smoke-loja-publica.png' })
  })

  test('página de login exibe campos esperados', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})
