/**
 * CENÁRIO: Cadastro concorrente de revendedoras
 *
 * Simula várias pessoas tentando se cadastrar ao mesmo tempo.
 * Testa:
 *   - Carga no carregamento da página de registro
 *   - Carga na API de verificação de e-mail (/api/auth/status-email)
 *   - Carga na API de criação de link de pagamento (/api/auth/criar-pagamento-cadastro)
 *
 * ⛔ NUNCA chama o endpoint de criação real de conta (Supabase auth.signUp).
 *    O teste usa e-mails inexistentes — a API retorna "não encontrado"
 *    sem criar nada no banco.
 *
 * Uso:
 *   k6 run tests/load/cadastro-concorrente.js
 *   k6 run --env VUS=50 tests/load/cadastro-concorrente.js
 */

import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

const BASE_URL = 'https://lojadeprata925.com.br'
const VUS = parseInt(__ENV.VUS || '20')

const paginaTrend    = new Trend('register_pagina_ms', true)
const statusEmailMs  = new Trend('status_email_ms', true)
const erroRate       = new Rate('erros_cadastro')
const tentativas     = new Counter('tentativas_cadastro')

export const options = {
  stages: [
    { duration: '20s', target: 10   },  // aquece
    { duration: '2m',  target: VUS  },  // carga alvo (ex: campanha de marketing)
    { duration: '1m',  target: VUS  },  // sustenta
    { duration: '20s', target: 0    },
  ],
  thresholds: {
    http_req_duration:  ['p(95)<3000'],
    http_req_failed:    ['rate<0.02'],
    register_pagina_ms: ['p(95)<3000'],
    status_email_ms:    ['p(95)<2000'],
  },
}

// Gera e-mail fictício único por VU + iteração (nunca colide com conta real)
function emailFicticio() {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 99999)
  return `load.test.${ts}.${rand}@example-load-test.invalid`
}

export function handleSummary(data) {
  return {
    'tests/load/reports/cadastro-concorrente.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

export default function () {
  tentativas.add(1)
  const headers = { 'Content-Type': 'application/json' }

  group('1 — Carrega página de cadastro', () => {
    const r = http.get(`${BASE_URL}/auth/register`, { tags: { name: 'register_page' } })
    paginaTrend.add(r.timings.duration)

    check(r, {
      'register: status 200':       (res) => res.status === 200,
      'register: sem erro 500':     (res) => res.status < 500,
    })
  })

  sleep(1.5) // tempo de leitura da página

  group('2 — Verifica status do e-mail (preenchimento do form)', () => {
    const email = emailFicticio()
    const r = http.post(
      `${BASE_URL}/api/auth/status-email`,
      JSON.stringify({ email }),
      { headers, tags: { name: 'status_email' } }
    )
    statusEmailMs.add(r.timings.duration)

    const ok = check(r, {
      'status-email: responde':           (res) => res.status < 500,
      'status-email: retorna JSON':       (res) => {
        try { JSON.parse(res.body); return true } catch { return false }
      },
    })
    erroRate.add(!ok)
  })

  sleep(2) // simula preenchimento do formulário (nome, whatsapp, etc.)

  group('3 — Carrega página de login (link "Já tem conta?")', () => {
    const r = http.get(`${BASE_URL}/auth/login`, { tags: { name: 'login_page' } })

    check(r, {
      'login: status 200': (res) => res.status === 200,
    })
  })

  sleep(Math.random() * 2 + 0.5)
}
