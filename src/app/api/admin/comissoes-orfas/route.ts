// GET /api/admin/comissoes-orfas — lista comissões cujo pedido NÃO está
// em status 'pago' (defesa em profundidade contra bugs futuros do trigger).
//
// POST /api/admin/comissoes-orfas?cancelar=true — cancela essas comissões.
//   Se a comissão estava 'liberada', o trigger comissoes_sincronizar_saldo
//   debita automaticamente do saldo_disponivel da revendedora.
//
// Auth: Bearer prata925.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function listarOrfas() {
  const admin = supabaseAdmin()
  const { data: comissoes } = await admin
    .from('comissoes')
    .select('id, pedido_id, valor_comissao, status, slug_revendedora, created_at')
    .neq('status', 'cancelada')

  const ids = (comissoes || [])
    .map(c => c.pedido_id)
    .filter((x): x is string => !!x)

  if (ids.length === 0) return []

  const { data: peds } = await admin
    .from('pedidos')
    .select('id, status, numero_pedido')
    .in('id', ids)

  const mapa = new Map<string, { status: string; numero: string }>()
  for (const p of peds || []) {
    mapa.set(p.id, { status: p.status, numero: p.numero_pedido })
  }

  return (comissoes || [])
    .map(c => {
      const ped = c.pedido_id ? mapa.get(c.pedido_id) : null
      if (!ped) return null
      if (ped.status === 'pago' || ped.status === 'enviado' || ped.status === 'entregue') return null
      return {
        id: c.id,
        numero_pedido: ped.numero,
        pedido_status: ped.status,
        comissao_status: c.status,
        valor_comissao: Number(c.valor_comissao || 0),
        slug_revendedora: c.slug_revendedora,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
}

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const orfas = await listarOrfas()
  return NextResponse.json({
    total: orfas.length,
    soma_valor: orfas.reduce((s, x) => s + x.valor_comissao, 0),
    orfas,
  })
}

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const url = new URL(request.url)
  const cancelar = url.searchParams.get('cancelar') === 'true'
  if (!cancelar) {
    return NextResponse.json({ erro: 'Adicione ?cancelar=true pra confirmar.' }, { status: 400 })
  }

  const orfas = await listarOrfas()
  if (orfas.length === 0) {
    return NextResponse.json({ ok: true, canceladas: 0, total_encontrado: 0 })
  }

  const admin = supabaseAdmin()
  const ids = orfas.map(o => o.id)
  const { error } = await admin
    .from('comissoes')
    .update({ status: 'cancelada' })
    .in('id', ids)
    .neq('status', 'paga') // protege comissões já pagas

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    canceladas: ids.length,
    detalhes: orfas,
  })
}
