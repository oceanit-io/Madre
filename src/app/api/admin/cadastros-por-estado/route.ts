// GET /api/admin/cadastros-por-estado — conta revendedoras por UF.
// Retorna { porUF: { SP: { total, ativas }, ... }, total, semUF }.
// Normaliza o campo `estado` (que é texto livre) pra sigla de 2 letras.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
])

// Nomes por extenso -> sigla (sem acento, maiúsculo).
const NOME_UF: Record<string, string> = {
  ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA',
  CEARA: 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES', GOIAS: 'GO',
  MARANHAO: 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG', PARA: 'PA', PARAIBA: 'PB', PARANA: 'PR',
  PERNAMBUCO: 'PE', PIAUI: 'PI', 'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', RONDONIA: 'RO',
  RORAIMA: 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', SERGIPE: 'SE',
  TOCANTINS: 'TO',
}

function normalizarUF(estado: string | null): string | null {
  const e = (estado || '').trim()
  if (!e) return null
  const up = e
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ')
  if (up.length === 2 && UFS.has(up)) return up
  return NOME_UF[up] || null
}

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('revendedoras')
    .select('estado, status')

  if (error) {
    return NextResponse.json({ erro: 'Erro ao consultar', detalhes: error.message }, { status: 500 })
  }

  const porUF: Record<string, { total: number; ativas: number }> = {}
  let semUF = 0
  for (const r of data || []) {
    const uf = normalizarUF(r.estado as string | null)
    if (!uf) { semUF++; continue }
    if (!porUF[uf]) porUF[uf] = { total: 0, ativas: 0 }
    porUF[uf].total++
    if (r.status === 'ativa') porUF[uf].ativas++
  }

  return NextResponse.json({
    porUF,
    total: (data || []).length,
    semUF,
  })
}
