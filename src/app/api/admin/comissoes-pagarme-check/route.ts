// GET /api/admin/comissoes-pagarme-check — diagnóstico: pra cada comissão em
// 'processando', consulta no Pagar.me o SALDO real do recebedor da revendedora
// (disponível + a liberar + já transferido). Assim dá pra saber QUEM de fato
// recebeu dinheiro pelo split — sem chutar.
//
// NÃO altera nada (só leitura). Admin-only. Usa a key do servidor.
// O saldo é por RECEBEDOR (soma de todos os pedidos dela), não por comissão —
// mas como são os únicos pedidos recentes, serve de sinal forte.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

type Balance = { available: number; waiting: number; transferred: number; total: number }

async function lerSaldoRecebedor(auth: string, rid: string): Promise<Balance | { erro: string }> {
  try {
    const resp = await fetch(`${BASE}/recipients/${rid}/balance`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      cache: 'no-store',
    })
    const txt = await resp.text().catch(() => '')
    if (!resp.ok) return { erro: `${resp.status}: ${txt.slice(0, 120)}` }
    const j = txt ? JSON.parse(txt) : {}
    // Pagar.me v5: amounts em CENTAVOS.
    const available = Number(j.available_amount || 0) / 100
    const waiting = Number(j.waiting_funds_amount || 0) / 100
    const transferred = Number(j.transferred_amount || 0) / 100
    return { available, waiting, transferred, total: available + waiting + transferred }
  } catch (e) {
    return { erro: String(e) }
  }
}

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')

  const supabase = supabaseAdmin()
  const { data: comissoes } = await supabase
    .from('comissoes')
    .select('id, slug_revendedora, valor_comissao, status, data_liberacao')
    .in('status', ['processando', 'liberada'])

  const slugs = Array.from(new Set((comissoes || []).map(c => c.slug_revendedora).filter(Boolean)))
  const { data: revs } = await supabase
    .from('revendedoras')
    .select('subdominio, nome, pagarme_recipient_id, pagarme_recipient_status')
    .in('subdominio', slugs as string[])

  const mapaRev = new Map((revs || []).map(r => [r.subdominio, r]))

  // Cache de saldo por recebedor (não consultar 2x o mesmo).
  const cacheSaldo = new Map<string, Balance | { erro: string }>()

  const resultados: Array<Record<string, unknown>> = []
  for (const c of comissoes || []) {
    const rev = mapaRev.get(c.slug_revendedora || '')
    const rid = rev?.pagarme_recipient_id || ''
    let saldo: Balance | { erro: string } | null = null
    if (rid) {
      if (!cacheSaldo.has(rid)) cacheSaldo.set(rid, await lerSaldoRecebedor(auth, rid))
      saldo = cacheSaldo.get(rid)!
    }
    const temSaldo = saldo && 'total' in saldo ? saldo.total > 0 : false
    resultados.push({
      comissao_id: c.id,
      pessoa: rev?.nome || null,
      loja: c.slug_revendedora,
      valor_comissao: Number(c.valor_comissao || 0),
      comissao_status: c.status,
      recebedor_status: rev?.pagarme_recipient_status || 'sem recebedor',
      saldo_pagarme: saldo,
      // veredito: recebeu dinheiro pelo Pagar.me?
      veredito: !rid ? 'SEM recebedor (modelo interno)'
        : saldo && 'erro' in saldo ? 'erro ao consultar'
        : temSaldo ? '✅ RECEBEU (tem saldo no Pagar.me)'
        : '— sem movimento (não recebeu pelo split)',
    })
  }

  // Ordena: quem recebeu primeiro.
  resultados.sort((a, b) => String(b.veredito).localeCompare(String(a.veredito)))

  const receberam = resultados.filter(r => String(r.veredito).startsWith('✅'))
  return NextResponse.json({
    total_comissoes: resultados.length,
    receberam_no_pagarme: receberam.length,
    resumo_receberam: receberam.map(r => `${r.pessoa} (${r.loja}) R$${r.valor_comissao}`),
    detalhe: resultados,
  })
}
