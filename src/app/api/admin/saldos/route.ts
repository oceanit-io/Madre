// GET /api/admin/saldos — saldo de todas revendedoras + agregados.
// Mostra: saldo_disponivel, saldo_processando, total_sacado, em_saque.
// Útil pra Gabriela ver quanto está devendo a cada uma.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const admin = supabaseAdmin()

  const { data: revs } = await admin
    .from('revendedoras')
    .select('id, nome, nome_loja, subdominio, status, saldo_disponivel, saldo_processando, total_ganho, total_vendas, pagarme_recipient_status')
    .order('saldo_disponivel', { ascending: false })

  const ids = (revs || []).map(r => r.id)
  const totalSacado = new Map<string, number>()
  const emSaque = new Map<string, number>()

  if (ids.length > 0) {
    const { data: saquesPagos } = await admin
      .from('saques')
      .select('revendedora_id, valor')
      .in('revendedora_id', ids)
      .eq('status', 'pago')
    for (const s of saquesPagos || []) {
      totalSacado.set(s.revendedora_id, (totalSacado.get(s.revendedora_id) || 0) + Number(s.valor || 0))
    }

    const { data: saquesPendentes } = await admin
      .from('saques')
      .select('revendedora_id, valor, status')
      .in('revendedora_id', ids)
      .in('status', ['solicitado', 'processando'])
    for (const s of saquesPendentes || []) {
      emSaque.set(s.revendedora_id, (emSaque.get(s.revendedora_id) || 0) + Number(s.valor || 0))
    }
  }

  const linhas = (revs || []).map(r => ({
    id: r.id,
    nome: r.nome,
    nome_loja: r.nome_loja,
    subdominio: r.subdominio,
    status: r.status,
    kyc_status: r.pagarme_recipient_status || 'pendente',
    saldo_disponivel: Number(r.saldo_disponivel || 0),
    saldo_processando: Number(r.saldo_processando || 0),
    total_ganho: Number(r.total_ganho || 0),
    total_vendas: Number(r.total_vendas || 0),
    total_sacado: totalSacado.get(r.id) || 0,
    em_saque: emSaque.get(r.id) || 0,
  }))

  const agregados = {
    total_disponivel: linhas.reduce((s, r) => s + r.saldo_disponivel, 0),
    total_processando: linhas.reduce((s, r) => s + r.saldo_processando, 0),
    total_em_saque: linhas.reduce((s, r) => s + r.em_saque, 0),
    total_ja_sacado: linhas.reduce((s, r) => s + r.total_sacado, 0),
    total_revendedoras: linhas.length,
  }

  return NextResponse.json({ revendedoras: linhas, agregados })
}
