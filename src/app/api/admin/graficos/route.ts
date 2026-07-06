import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { situacaoMensalidade } from '@/lib/mensalidade'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  // ---- Faturamento últimos 30 dias (pago/enviado/entregue) ----
  const ini = new Date()
  ini.setHours(0, 0, 0, 0)
  ini.setDate(ini.getDate() - 29)

  const { data: peds } = await supabase
    .from('pedidos')
    .select('total, created_at, status')
    .gte('created_at', ini.toISOString())
    .in('status', ['pago', 'enviado', 'entregue'])

  const mapaDia = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(ini.getTime() + i * 86400000)
    mapaDia.set(d.toISOString().slice(0, 10), 0)
  }
  for (const p of peds || []) {
    const dia = new Date(p.created_at).toISOString().slice(0, 10)
    if (mapaDia.has(dia)) {
      mapaDia.set(dia, (mapaDia.get(dia) || 0) + Number(p.total || 0))
    }
  }
  const faturamento = Array.from(mapaDia.entries()).map(([dia, total]) => ({
    dia,
    total: Math.round(total * 100) / 100,
  }))

  // ---- Pedidos por status (todos) ----
  const { data: todos } = await supabase.from('pedidos').select('status')
  const statusCounts: Record<string, number> = {
    aguardando_pagamento: 0,
    pago: 0,
    enviado: 0,
    entregue: 0,
    cancelado: 0,
  }
  for (const p of todos || []) {
    if (p.status in statusCounts) statusCounts[p.status]++
  }

  // ---- Top revendedoras (comissões liberada/paga) ----
  let top: { nome: string; total: number; qtd: number }[] = []
  try {
    const { data: coms, error } = await supabase
      .from('comissoes')
      .select('slug_revendedora, valor_comissao, status')
      .in('status', ['liberada', 'paga'])
    if (!error && coms) {
      const agg = new Map<string, { total: number; qtd: number }>()
      for (const c of coms) {
        const s = c.slug_revendedora || '—'
        const cur = agg.get(s) || { total: 0, qtd: 0 }
        cur.total += Number(c.valor_comissao || 0)
        cur.qtd += 1
        agg.set(s, cur)
      }
      const slugs = Array.from(agg.keys()).filter(s => s !== '—')
      const nomes = new Map<string, string>()
      if (slugs.length > 0) {
        const { data: revs } = await supabase
          .from('revendedoras')
          .select('nome, nome_loja, subdominio')
          .in('subdominio', slugs)
        for (const r of revs || []) {
          nomes.set(r.subdominio, r.nome_loja || r.nome)
        }
      }
      top = Array.from(agg.entries())
        .map(([slug, v]) => ({ nome: nomes.get(slug) || slug, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
    }
  } catch {
    top = []
  }

  // ---- Mensalidades (pode não existir a coluna ainda) ----
  let mens: Record<string, number> | null = null
  try {
    const { data: revs, error } = await supabase
      .from('revendedoras')
      .select('mensalidade_vence_em, mensalidade_isento')
    if (!error && revs) {
      mens = { em_dia: 0, a_vencer: 0, vence_hoje: 0, vencida: 0, isento: 0, sem_data: 0 }
      for (const r of revs) {
        const { situacao } = situacaoMensalidade(
          r.mensalidade_vence_em,
          !!r.mensalidade_isento
        )
        mens[situacao] = (mens[situacao] || 0) + 1
      }
    }
  } catch {
    mens = null
  }

  return NextResponse.json({ faturamento, statusCounts, top, mens })
}
