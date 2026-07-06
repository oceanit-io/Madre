/**
 * CENÁRIO: Navegação na vitrine pública
 *
 * Simula usuários abrindo a loja, carregando produtos e abrindo
 * a página de detalhe de um produto. É o fluxo mais comum na plataforma.
 *
 * Rota segura: somente leitura, nunca gera pedido/cobrança.
 *
 * Uso:
 *   k6 run tests/load/browse-storefront.js              (load padrão)
 *   k6 run --env SLUG=outro-slug tests/load/browse-storefront.js
 */

import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

const BASE_URL = 'https://lojadeprata925.com.br'
const SLUG = __ENV.SLUG || 'jarlessayharesantana-5310'

// Métricas customizadas
const storeTrend  = new Trend('vitrine_carregamento_ms', true)
const prodTrend   = new Trend('produtos_api_ms', true)
const erroRate    = new Rate('erros')

export const options = {
  stages: [
    { duration: '30s', target: 5  },  // aquece — sobe para 5 usuários
    { duration: '2m',  target: 20 },  // carga normal — 20 usuários simultâneos
    { duration: '1m',  target: 40 },  // pico — dobra a carga
    { duration: '30s', target: 0  },  // resfria
  ],
  thresholds: {
    // 95% das requisições devem responder em menos de 3s
    http_req_duration:       ['p(95)<3000'],
    // Menos de 2% de erros
    http_req_failed:         ['rate<0.02'],
    vitrine_carregamento_ms: ['p(95)<4000'],
    produtos_api_ms:         ['p(95)<2000'],
  },
}

export function handleSummary(data) {
  return {
    'tests/load/reports/browse-storefront.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

export default function () {
  const headers = { 'Accept': 'application/json' }

  group('1 — Abre a vitrine', () => {
    const r = http.get(`${BASE_URL}/loja/${SLUG}`, { tags: { name: 'vitrine' } })
    storeTrend.add(r.timings.duration)

    const ok = check(r, {
      'vitrine: status 200':          (res) => res.status === 200,
      'vitrine: sem erro 500':        (res) => res.status < 500,
      'vitrine: tem conteúdo':        (res) => (res.body?.length || 0) > 500,
    })
    erroRate.add(!ok)
  })

  sleep(1) // pensa por 1 segundo antes do próximo passo

  group('2 — Carrega dados da loja via API', () => {
    const r = http.get(`${BASE_URL}/api/loja/${SLUG}`, { headers, tags: { name: 'api_loja' } })

    check(r, {
      'api_loja: status 200':         (res) => res.status === 200,
      'api_loja: body é JSON':        (res) => { try { JSON.parse(res.body); return true } catch { return false } },
    })
  })

  sleep(0.5)

  group('3 — Carrega lista de produtos', () => {
    const r = http.get(`${BASE_URL}/api/produtos?slug=${SLUG}`, { headers, tags: { name: 'api_produtos' } })
    prodTrend.add(r.timings.duration)

    check(r, {
      'api_produtos: status 200':     (res) => res.status === 200,
      'api_produtos: retorna array':  (res) => { try { return Array.isArray(JSON.parse(res.body)) } catch { return false } },
    })
  })

  // Simula rolagem da página + tempo de leitura
  sleep(Math.random() * 2 + 1)
}
