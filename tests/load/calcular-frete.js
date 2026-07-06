/**
 * CENÁRIO: Cálculo de frete (Correios PPN)
 *
 * A integração com Correios é o gargalo mais provável da plataforma —
 * cada cálculo faz 2 chamadas externas (auth + cotação). Este script
 * testa quantas requisições simultâneas o sistema aguenta antes de
 * começar a retornar erro ou demorar demais.
 *
 * Rota segura: somente leitura.
 *
 * Uso:
 *   k6 run tests/load/calcular-frete.js
 *   k6 run --env VUS=30 tests/load/calcular-frete.js
 */

import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

const BASE_URL = 'https://lojadeprata925.com.br'
const VUS = parseInt(__ENV.VUS || '15')

// CEPs reais de diferentes regiões do Brasil para variar o teste
const CEPS = [
  { cep: '01310100', uf: 'SP', cidade: 'São Paulo'         },
  { cep: '20040020', uf: 'RJ', cidade: 'Rio de Janeiro'    },
  { cep: '30130110', uf: 'MG', cidade: 'Belo Horizonte'    },
  { cep: '40020010', uf: 'BA', cidade: 'Salvador'          },
  { cep: '49010060', uf: 'SE', cidade: 'Aracaju'           }, // mesmo estado do DR Correios
  { cep: '60135060', uf: 'CE', cidade: 'Fortaleza'         },
  { cep: '80010010', uf: 'PR', cidade: 'Curitiba'          },
  { cep: '90010050', uf: 'RS', cidade: 'Porto Alegre'      },
]

const freteTrend  = new Trend('frete_calculo_ms', true)
const cepTrend    = new Trend('cep_lookup_ms', true)
const erroRate    = new Rate('erros_frete')

export const options = {
  vus: VUS,
  stages: [
    { duration: '20s', target: Math.floor(VUS / 3) },  // aquece
    { duration: '2m',  target: VUS                 },  // carga alvo
    { duration: '30s', target: VUS * 2             },  // pico de 2x
    { duration: '20s', target: 0                   },  // resfria
  ],
  thresholds: {
    http_req_duration:  ['p(95)<5000'],  // frete pode demorar até 5s (Correios externos)
    http_req_failed:    ['rate<0.05'],   // até 5% de erro é aceitável (Correios flaky)
    frete_calculo_ms:   ['p(95)<5000'],
    cep_lookup_ms:      ['p(95)<2000'],
  },
}

export function handleSummary(data) {
  return {
    'tests/load/reports/calcular-frete.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

export default function () {
  // Pega um CEP aleatório da lista para diversificar o teste
  const destino = CEPS[Math.floor(Math.random() * CEPS.length)]

  const headers = { 'Content-Type': 'application/json' }

  group('1 — Lookup de CEP', () => {
    const r = http.get(`${BASE_URL}/api/cep/${destino.cep}`, { tags: { name: 'cep_lookup' } })
    cepTrend.add(r.timings.duration)

    check(r, {
      'cep: status 200':    (res) => res.status === 200,
      'cep: retorna uf':    (res) => {
        try { return !!JSON.parse(res.body).uf } catch { return false }
      },
    })
  })

  sleep(0.2)

  group('2 — Calcular frete PAC + SEDEX', () => {
    const payload = JSON.stringify({
      uf: destino.uf,
      cep: destino.cep,
      subtotal: 89.90,  // valor abaixo do frete grátis (R$250) para forçar cotação real
      qntItens: 2,
    })

    const r = http.post(`${BASE_URL}/api/frete`, payload, {
      headers,
      tags: { name: 'frete_calculo' },
    })
    freteTrend.add(r.timings.duration)

    const ok = check(r, {
      'frete: status 200':       (res) => res.status === 200,
      'frete: tem opcoes':       (res) => {
        try {
          const body = JSON.parse(res.body)
          return Array.isArray(body.opcoes) && body.opcoes.length > 0
        } catch { return false }
      },
      'frete: PAC ou SEDEX':     (res) => {
        try {
          const body = JSON.parse(res.body)
          return body.opcoes?.some(o => o.servico === 'PAC' || o.servico === 'SEDEX')
        } catch { return false }
      },
    })
    erroRate.add(!ok)
  })

  // Pausa realista entre cálculos (usuário olhando as opções)
  sleep(Math.random() * 3 + 1)
}
