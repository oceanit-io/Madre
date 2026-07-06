/**
 * CENÁRIO: Mix realista de tráfego
 *
 * Combina todos os fluxos numa proporção que reflete o uso real:
 *   - 50% navegação na vitrine
 *   - 25% cálculo de frete
 *   - 15% cadastro / verificação de e-mail
 *   - 10% página de checkout (sem submeter pagamento)
 *
 * Use este script para descobrir o limite real da plataforma antes
 * de uma campanha de marketing ou lançamento.
 *
 * ⛔ NUNCA submete pedidos nem cria contas reais.
 *
 * Uso:
 *   k6 run tests/load/stress-mix.js                    (smoke: 5 VUs)
 *   k6 run --env MODO=carga   tests/load/stress-mix.js (20 VUs, 5 min)
 *   k6 run --env MODO=stress  tests/load/stress-mix.js (rampa até 80 VUs)
 *   k6 run --env MODO=spike   tests/load/stress-mix.js (pico repentino)
 */

import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

const BASE_URL = 'https://lojadeprata925.com.br'
const SLUG = __ENV.SLUG || 'jarlessayharesantana-5310'
const MODO  = __ENV.MODO  || 'smoke'

// Trends por endpoint — aparecem como linhas separadas no HTML (aba Detailed Metrics)
const vitrineTrend  = new Trend('endpoint_vitrine_ms',  true)
const produtosTrend = new Trend('endpoint_produtos_ms', true)
const freteTrend    = new Trend('endpoint_frete_ms',    true)
const cepTrend      = new Trend('endpoint_cep_ms',      true)
const registerTrend = new Trend('endpoint_register_ms', true)

// Parâmetros por modo
const MODOS = {
  smoke: {
    stages: [
      { duration: '30s', target: 2 },
      { duration: '30s', target: 0 },
    ],
  },
  carga: {
    stages: [
      { duration: '1m',  target: 10 },
      { duration: '3m',  target: 20 },
      { duration: '1m',  target: 0  },
    ],
  },
  stress: {
    stages: [
      { duration: '1m',  target: 20 },
      { duration: '2m',  target: 40 },
      { duration: '2m',  target: 80 },  // limite superior — veja onde começa a falhar
      { duration: '1m',  target: 0  },
    ],
  },
  spike: {
    stages: [
      { duration: '10s', target: 5  },  // baseline baixo
      { duration: '10s', target: 60 },  // pico repentino (influencer postou!)
      { duration: '1m',  target: 60 },  // sustenta o pico
      { duration: '10s', target: 5  },  // volta ao normal
      { duration: '30s', target: 0  },
    ],
  },
}

const CEP_EXEMPLO = '01310100'
const CEPS = ['01310100', '20040020', '30130110', '49010060', '80010010']

export const options = {
  stages: (MODOS[MODO] || MODOS.smoke).stages,
  thresholds: {
    http_req_duration:      ['p(95)<4000'],
    http_req_failed:        ['rate<0.05'],
    // por endpoint — aparecem individualmente no HTML
    endpoint_vitrine_ms:    ['p(95)<3000'],
    endpoint_produtos_ms:   ['p(95)<5000'],
    endpoint_frete_ms:      ['p(95)<8000'],  // Correios externo — tolerância maior
    endpoint_cep_ms:        ['p(95)<3000'],
    endpoint_register_ms:   ['p(95)<3000'],
  },
}

// Distribui o fluxo por peso — retorna o tipo de cenário para esta iteração
function sortearCenario() {
  const n = Math.random() * 100
  if (n < 50) return 'vitrine'
  if (n < 75) return 'frete'
  if (n < 90) return 'cadastro'
  return 'checkout'
}

export function handleSummary(data) {
  return {
    [`tests/load/reports/stress-mix-${MODO}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

export default function () {
  const cenario = sortearCenario()
  const headers = { 'Content-Type': 'application/json' }

  if (cenario === 'vitrine') {
    // --- 50%: navegação na vitrine ---
    group('vitrine', () => {
      const r = http.get(`${BASE_URL}/loja/${SLUG}`, { tags: { name: 'vitrine' } })
      vitrineTrend.add(r.timings.duration)
      check(r, { 'vitrine 200': (res) => res.status === 200 })
      sleep(0.5)

      const api = http.get(`${BASE_URL}/api/produtos?slug=${SLUG}`, { tags: { name: 'produtos' } })
      produtosTrend.add(api.timings.duration)
      check(api, { 'produtos 200': (res) => res.status === 200 })
    })
    sleep(Math.random() * 2 + 1)

  } else if (cenario === 'frete') {
    // --- 25%: cálculo de frete ---
    group('frete', () => {
      const cep = CEPS[Math.floor(Math.random() * CEPS.length)]

      const rCep = http.get(`${BASE_URL}/api/cep/${cep}`, { tags: { name: 'cep' } })
      cepTrend.add(rCep.timings.duration)
      let uf = 'SP'
      try { uf = JSON.parse(rCep.body)?.uf || 'SP' } catch { /* usa SP como fallback */ }

      sleep(0.3)

      const rFrete = http.post(
        `${BASE_URL}/api/frete`,
        JSON.stringify({ uf, cep, subtotal: 89.90, qntItens: 1 }),
        { headers, tags: { name: 'frete' } }
      )
      freteTrend.add(rFrete.timings.duration)
      check(rFrete, {
        'frete 200':      (res) => res.status === 200,
        'frete tem opcao': (res) => {
          try { return (JSON.parse(res.body).opcoes?.length || 0) > 0 } catch { return false }
        },
      })
    })
    sleep(Math.random() * 2 + 1)

  } else if (cenario === 'cadastro') {
    // --- 15%: fluxo de cadastro ---
    group('cadastro', () => {
      const rPage = http.get(`${BASE_URL}/auth/register`, { tags: { name: 'register' } })
      registerTrend.add(rPage.timings.duration)
      check(rPage, { 'register 200': (res) => res.status === 200 })

      sleep(1)

      const email = `load.${Date.now()}.${Math.floor(Math.random() * 9999)}@example-load.invalid`
      const rStatus = http.post(
        `${BASE_URL}/api/auth/status-email`,
        JSON.stringify({ email }),
        { headers, tags: { name: 'status_email' } }
      )
      check(rStatus, { 'status-email responde': (res) => res.status < 500 })
    })
    sleep(Math.random() * 3 + 1)

  } else {
    // --- 10%: página de checkout ---
    group('checkout', () => {
      const rCarrinho = http.get(`${BASE_URL}/carrinho`, { tags: { name: 'carrinho' } })
      check(rCarrinho, { 'carrinho 200': (res) => res.status === 200 })

      sleep(0.5)

      const rCheckout = http.get(`${BASE_URL}/checkout`, { tags: { name: 'checkout' } })
      check(rCheckout, { 'checkout sem 500': (res) => res.status < 500 })
    })
    sleep(Math.random() * 2 + 1)
  }
}
