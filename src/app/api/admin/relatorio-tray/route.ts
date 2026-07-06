import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Vendas confirmadas (pago/enviado/entregue) ainda NÃO abatidas na Tray.
// O dono usa isto pra dar baixa do estoque na Tray e não ter conflito.
const STATUS_CONFIRMADO = ['pago', 'enviado', 'entregue']

function db() {
  return supabaseAdmin()
}

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = db()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero_pedido, created_at, status, itens, baixado_tray')
    .in('status', STATUS_CONFIRMADO)
    .eq('baixado_tray', false)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao consultar', detalhes: error.message },
      { status: 500 }
    )
  }

  const pedidos = data || []
  const mapa = new Map<string, { sku: string; nome: string; qtd: number }>()
  for (const p of pedidos) {
    const itens = Array.isArray(p.itens) ? p.itens : []
    for (const it of itens) {
      const sku = String(it.sku || it.id || '—')
      const q = Math.max(1, Math.floor(Number(it.quantidade) || 1))
      const cur = mapa.get(sku) || { sku, nome: it.nome || '', qtd: 0 }
      cur.qtd += q
      if (!cur.nome && it.nome) cur.nome = it.nome
      mapa.set(sku, cur)
    }
  }

  const resumo = Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd)

  return NextResponse.json({
    totalPedidos: pedidos.length,
    totalItens: resumo.reduce((a, r) => a + r.qtd, 0),
    resumo, // [{sku, nome, qtd}] -> o que dar baixa na Tray
    pedidos: pedidos.map(p => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      created_at: p.created_at,
      status: p.status,
      itens: Array.isArray(p.itens) ? p.itens : [],
    })),
  })
}

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: { ids?: string[]; todos?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const supabase = db()
  let q = supabase
    .from('pedidos')
    .update({ baixado_tray: true, baixado_tray_em: new Date().toISOString() })

  if (body.todos) {
    q = q.in('status', STATUS_CONFIRMADO).eq('baixado_tray', false)
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    q = q.in('id', body.ids)
  } else {
    return NextResponse.json({ erro: 'Nada para marcar' }, { status: 400 })
  }

  const { error } = await q
  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao marcar', detalhes: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
