// Lógica de frete: tabela fixa por região (fallback) + opções calculadas
// em tempo real via Correios PPN quando há env vars [[lib-correios]].
//
// Regra de frete grátis: subtotal >= FRETE_GRATIS_MINIMO → valor 0
// independente do serviço escolhido.

import { calcularFretesCorreios, PESO_FIXO_GRAMAS, CAIXA_PADRAO } from './correios'

export const FRETE_GRATIS_MINIMO = 250
export const PRAZO_DIAS_MIN = 5
export const PRAZO_DIAS_MAX = 12

export type RegiaoFrete = 'sudeste' | 'sul' | 'nordeste' | 'norte_centro_oeste'
export type ServicoFrete = 'PAC' | 'SEDEX' | 'PADRAO'

const SUDESTE = ['SP', 'RJ', 'MG', 'ES']
const SUL = ['PR', 'SC', 'RS']
const NORDESTE = ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI']

// ============================================================
// Fallback REAL por UF — tarifas do contrato PPN PLATINUM SP origem.
// Valores extraídos do CSV oficial Correios (faixa 301-500g SEDEX, que
// é onde nossas embalagens caem com peso real + cúbico).
//
// Quando a API Correios falha, o sistema usa esses valores em vez de
// chutar baixo (antes: SE/SP=15, SUL=18, NE=22, NORTE=30 — todos abaixo
// do custo real, gerava prejuízo por pedido em fallback).
//
// Estratégia: valor da capital de cada UF (~95% dos pedidos vão pra
// metro). Pequenos interiores podem ficar levemente subestimados mas
// fallback é raro (Correios responde >99% das vezes).
// ============================================================
const FALLBACK_SEDEX_BY_UF: Record<string, number> = {
  // Sudeste
  SP: 11.15,   // L1 capital + grande SP
  RJ: 30.06,   // N1 capital + grande Rio
  MG: 30.06,   // N1 BH + Contagem + Betim
  ES: 30.06,   // N1 Vitória + Vila Velha + Serra
  // Sul (todos N1 nas capitais)
  PR: 30.06,
  SC: 30.06,
  RS: 30.06,
  // Centro-Oeste
  DF: 30.06,   // N1 Brasília
  GO: 30.06,   // N1 Goiânia + Anápolis
  MS: 30.06,   // N1 Campo Grande
  MT: 42.08,   // N2 Cuiabá
  // Nordeste
  BA: 42.08,   // N2 Salvador
  PE: 54.09,   // N3 Recife
  CE: 54.09,   // N3 Fortaleza
  SE: 63.10,   // N4 Aracaju
  AL: 63.10,   // N4 Maceió
  PB: 63.10,   // N4 João Pessoa
  RN: 63.10,   // N4 Natal
  PI: 63.10,   // N4 Teresina
  MA: 63.10,   // N4 São Luís
  // Norte
  PA: 54.09,   // N3 Belém
  TO: 54.09,   // N3 Palmas
  AP: 63.10,   // N4 Macapá
  AM: 63.10,   // N4 Manaus
  RR: 63.10,   // N4 Boa Vista
  RO: 63.10,   // N4 Porto Velho
  AC: 63.10,   // N4 Rio Branco
}

const FALLBACK_PADRAO = 63.10 // UF desconhecida → tarifa Norte (mais cara)

export function regiaoPorUf(uf: string): { regiao: RegiaoFrete; valorBase: number } {
  const u = (uf || '').trim().toUpperCase()
  const valorBase = FALLBACK_SEDEX_BY_UF[u] ?? FALLBACK_PADRAO
  if (SUDESTE.includes(u)) return { regiao: 'sudeste', valorBase }
  if (SUL.includes(u)) return { regiao: 'sul', valorBase }
  if (NORDESTE.includes(u)) return { regiao: 'nordeste', valorBase }
  return { regiao: 'norte_centro_oeste', valorBase }
}

export type OpcaoFrete = {
  servico: ServicoFrete
  valor: number
  gratis: boolean
  prazo_dias_min: number
  prazo_dias_max: number
  regiao: RegiaoFrete
  origem: 'correios' | 'tabela'
}

export type ResultadoFretes = {
  opcoes: OpcaoFrete[]
  // Repete a região no top-level pra clientes que só precisam disso.
  regiao: RegiaoFrete
}

// Mantido para compatibilidade interna (usos legados, ex: server recalc
// rápido sem chamar Correios). Devolve a tabela fixa.
export function calcularFrete(uf: string, subtotal: number): OpcaoFrete {
  const { regiao, valorBase } = regiaoPorUf(uf)
  const gratis = Number(subtotal) >= FRETE_GRATIS_MINIMO
  return {
    servico: 'PADRAO',
    valor: gratis ? 0 : valorBase,
    gratis,
    prazo_dias_min: PRAZO_DIAS_MIN,
    prazo_dias_max: PRAZO_DIAS_MAX,
    regiao,
    origem: 'tabela',
  }
}

// Calcula opções de frete. Tenta Correios (PAC + SEDEX); se faltar env ou
// der erro cai pra tabela fixa (1 opção "PADRAO"). Frete grátis vence sempre.
export async function calcularFretes(
  uf: string,
  cepDestino: string,
  subtotal: number,
  qntItens: number,
): Promise<ResultadoFretes> {
  const { regiao, valorBase } = regiaoPorUf(uf)
  const gratis = Number(subtotal) >= FRETE_GRATIS_MINIMO
  const cep = (cepDestino || '').replace(/\D/g, '')
  // qntItens é aceito pra compat; com contrato "por pacote" mando peso
  // fixo seguro (PESO_FIXO_GRAMAS) que cabe no pacote contratado.
  void qntItens

  // Prazos comerciais fixos exibidos ao cliente (escolhidos pela
  // Gabriela com base na operação real Sergipe → BR). Não usamos os
  // prazos retornados pelos Correios — eles costumam vir conservadores
  // e poluem a vitrine com ranges grandes (5-12 dias).
  // Aqui ficam só os min/max de cada serviço.
  const PRAZO_FIXO = {
    PAC:   { min: 4, max: 4 },
    SEDEX: { min: 1, max: 1 },
  } as const

  // Frete grátis: não precisa consultar Correios. Mostramos as duas opções
  // a valor 0 com os mesmos prazos comerciais fixos.
  if (gratis) {
    return {
      regiao,
      opcoes: [
        { servico: 'PAC',   valor: 0, gratis: true, prazo_dias_min: PRAZO_FIXO.PAC.min,   prazo_dias_max: PRAZO_FIXO.PAC.max,   regiao, origem: 'tabela' },
        { servico: 'SEDEX', valor: 0, gratis: true, prazo_dias_min: PRAZO_FIXO.SEDEX.min, prazo_dias_max: PRAZO_FIXO.SEDEX.max, regiao, origem: 'tabela' },
      ],
    }
  }

  if (cep.length === 8) {
    const correios = await calcularFretesCorreios({
      cepDestino: cep,
      pesoG: PESO_FIXO_GRAMAS,
      ...CAIXA_PADRAO,
    })
    if (correios && correios.length > 0) {
      return {
        regiao,
        opcoes: correios.map(c => {
          const fixo = c.servico === 'SEDEX' ? PRAZO_FIXO.SEDEX : PRAZO_FIXO.PAC
          return {
            servico: c.servico,
            valor: c.valor,
            gratis: false,
            prazo_dias_min: fixo.min,
            prazo_dias_max: fixo.max,
            regiao,
            origem: 'correios' as const,
          }
        }),
      }
    }
  }

  // Fallback: tabela fixa, uma opção PADRAO.
  return {
    regiao,
    opcoes: [{
      servico: 'PADRAO',
      valor: valorBase,
      gratis: false,
      prazo_dias_min: PRAZO_DIAS_MIN,
      prazo_dias_max: PRAZO_DIAS_MAX,
      regiao,
      origem: 'tabela',
    }],
  }
}

// Helper pro server validar que o serviço escolhido no checkout existe nas
// opções calculadas e devolver o valor confiável (anti-tamper). Compara
// recalculando server-side com os mesmos params.
export async function valorConfiavelDoServico(
  uf: string,
  cepDestino: string,
  subtotal: number,
  qntItens: number,
  servicoEscolhido: ServicoFrete,
): Promise<OpcaoFrete | null> {
  const { opcoes } = await calcularFretes(uf, cepDestino, subtotal, qntItens)
  return opcoes.find(o => o.servico === servicoEscolhido) ?? opcoes[0] ?? null
}

// Para compat retroativa com chamadas que esperavam ResultadoFrete antigo.
export type ResultadoFrete = OpcaoFrete
