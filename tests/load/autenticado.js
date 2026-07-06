/**
 * CENÁRIO: Endpoints autenticados sob carga
 *
 * Testa as rotas que exigem token — dashboard da revendedora e painel admin.
 * O `setup()` faz login no Supabase UMA vez e compartilha o token com todos
 * os VUs. Tokens Supabase duram ~1h, o suficiente para qualquer teste.
 *
 * Pré-requisito: variáveis em .env.test preenchidas:
 *   TEST_EMAIL, TEST_PASSWORD, SUPABASE_ANON_KEY, ADMIN_TOKEN
 *
 * Uso:
 *   npm run test:load:autenticado
 *   npm run test:load:autenticado:report  (gera HTML)
 */

import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

const BASE_URL      = 'https://lojadeprata925.com.br'
const SUPABASE_URL  = 'https://ipovxwzzqjjywratrbjx.supabase.co'
const ANON_KEY      = __ENV.SUPABASE_ANON_KEY || ''
const ADMIN_TOKEN   = __ENV.ADMIN_TOKEN       || 'prata925'

const perfilTrend     = new Trend('revendedora_meu_status_ms', true)
const financeiroTrend = new Trend('revendedora_financeiro_ms', true)
const adminTrend      = new Trend('admin_stats_ms',            true)
const erroRate        = new Rate('erros_auth')

export const options = {
  stages: [
    { duration: '20s', target: 5  },
    { duration: '2m',  target: 10 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_duration:         ['p(95)<3000'],
    http_req_failed:           ['rate<0.02'],
    revendedora_meu_status_ms: ['p(95)<2000'],
    revendedora_financeiro_ms: ['p(95)<3000'],
    admin_stats_ms:            ['p(95)<3000'],
  },
}

// Roda UMA vez antes dos VUs. Faz login e devolve o token pra todos.
export function setup() {
  if (!ANON_KEY) {
    console.warn('\n⚠️  SUPABASE_ANON_KEY não está em .env.test — testes de revendedora vão falhar com 401.\n   Pegue em: Supabase dashboard → Settings → API → anon public\n')
  }

  const r = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email:    __ENV.TEST_EMAIL    || '',
      password: __ENV.TEST_PASSWORD || '',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
    }
  )

  if (r.status !== 200) {
    console.error(`\n❌ Login Supabase falhou (${r.status}): ${r.body}\n`)
    return { token: '', adminToken: ADMIN_TOKEN }
  }

  const token = JSON.parse(r.body).access_token || ''
  console.log(`\n✅ Login OK — token obtido (${token.length} chars)\n`)
  return { token, adminToken: ADMIN_TOKEN }
}

export function handleSummary(data) {
  return {
    'tests/load/reports/autenticado.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

export default function (data) {
  const { token, adminToken } = data
  const authHeaders      = { Authorization: `Bearer ${token}` }
  const adminHeaders     = { Authorization: `Bearer ${adminToken}` }

  // --- ROTAS DA REVENDEDORA ---

  // /api/revendedora/perfil só tem PATCH (atualizar) — sem GET.
  // meu-status é o GET que retorna dados da conta da revendedora.
  group('revendedora/meu-status', () => {
    const r = http.get(`${BASE_URL}/api/revendedora/meu-status`, {
      headers: authHeaders,
      tags: { name: 'rev_meu_status' },
    })
    perfilTrend.add(r.timings.duration)

    const ok = check(r, {
      'meu-status: 200':          (res) => res.status === 200,
      'meu-status: retorna JSON': (res) => { try { JSON.parse(res.body); return true } catch { return false } },
    })
    erroRate.add(!ok)
  })

  sleep(0.4)

  group('revendedora/financeiro', () => {
    const r = http.get(`${BASE_URL}/api/revendedora/financeiro`, {
      headers: authHeaders,
      tags: { name: 'rev_financeiro' },
    })
    financeiroTrend.add(r.timings.duration)

    check(r, {
      'financeiro: 200':          (res) => res.status === 200,
    })
  })

  sleep(0.4)

  group('revendedora/pedidos', () => {
    const r = http.get(`${BASE_URL}/api/revendedora/pedidos`, {
      headers: authHeaders,
      tags: { name: 'rev_pedidos' },
    })

    check(r, {
      'pedidos: 200 ou 404':      (res) => res.status === 200 || res.status === 404,
    })
  })

  sleep(0.5)

  // --- ROTAS DO ADMIN ---
  // responseCallback: informa ao k6 que 401/403 são respostas esperadas (token
  // pode ser inválido em ambiente de teste) e não devem contar em http_req_failed.

  group('admin/stats', () => {
    const r = http.get(`${BASE_URL}/api/admin/stats`, {
      headers: adminHeaders,
      tags: { name: 'admin_stats' },
      responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 401, 403),
    })
    adminTrend.add(r.timings.duration)

    if (r.status === 401 || r.status === 403) {
      console.warn(`[admin/stats] ${r.status} — atualize ADMIN_TOKEN no .env.test com o ADMIN_PIN do Vercel`)
    }
    check(r, {
      'admin/stats: sem 500':     (res) => res.status < 500,
    })
  })

  sleep(0.3)

  group('admin/revendedoras', () => {
    const r = http.get(`${BASE_URL}/api/admin/revendedoras`, {
      headers: adminHeaders,
      tags: { name: 'admin_revendedoras' },
      responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 401, 403),
    })

    if (r.status === 401 || r.status === 403) {
      console.warn(`[admin/revendedoras] ${r.status} — atualize ADMIN_TOKEN no .env.test com o ADMIN_PIN do Vercel`)
    }
    check(r, {
      'admin/revendedoras: sem 500': (res) => res.status < 500,
    })
  })

  sleep(Math.random() * 2 + 1)
}
