// GET /api/admin/vendas — pedidos PAGOS (+ enviado/entregue) com agregados
// por revendedora. Filtros opcionais por slug + mês (YYYY-MM).

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const admin = supabaseAdmin()

  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') || ''
  const mes = url.searchParams.get('mes') || '' // YYYY-MM

  let q = admin
    .from('pedidos')
    .select('id, numero_pedido, cliente_nome, cliente_email, status, slug_revendedora, subtotal, frete, total, codigo_rastreio, created_at')
    .in('status', ['pago', 'enviado', 'entregue'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (slug) q = q.eq('slug_revendedora', slug)
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number)
    const inicio = new Date(Date.UTC(y, m - 1, 1)).toISOString()
    const fim = new Date(Date.UTC(y, m, 1)).toISOString()
    q = q.gte('created_at', inicio).lt('created_at', fim)
  }

  const { data: pedidos } = await q
  const lista = pedidos || []

  // Agrupa por revendedora
  const porRev = new Map<string, { slug: string; vendas: number; faturamento: number; comissao: number }>()
  const REV_PERCENT = Number(process.env.PAGARME_REVENDEDORA_PERCENT) || 0.30
  for (const p of lista) {
    const k = (p.slug_revendedora as string) || '(sem rev)'
    const subtotal = Number(p.subtotal || 0)
    const existing = porRev.get(k) || { slug: k, vendas: 0, faturamento: 0, comissao: 0 }
    existing.vendas += 1
    existing.faturamento += Number(p.total || 0)
    existing.comissao += subtotal * REV_PERCENT
    porRev.set(k, existing)
  }
  const porRevArr = Array.from(porRev.values()).sort((a, b) => b.faturamento - a.faturamento)

  const totais = {
    pedidos: lista.length,
    faturamento_total: lista.reduce((s, p) => s + Number(p.total || 0), 0),
    subtotal_total: lista.reduce((s, p) => s + Number(p.subtotal || 0), 0),
    frete_total: lista.reduce((s, p) => s + Number(p.frete || 0), 0),
    comissao_total_revs: lista.reduce((s, p) => s + Number(p.subtotal || 0) * REV_PERCENT, 0),
  }

  return NextResponse.json({
    filtros: { slug, mes },
    totais,
    por_revendedora: porRevArr,
    pedidos: lista.map(p => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      cliente_nome: p.cliente_nome,
      cliente_email: p.cliente_email,
      status: p.status,
      slug_revendedora: p.slug_revendedora,
      subtotal: Number(p.subtotal || 0),
      frete: Number(p.frete || 0),
      total: Number(p.total || 0),
      comissao_rev: Number(p.subtotal || 0) * REV_PERCENT,
      codigo_rastreio: (p as { codigo_rastreio?: string | null }).codigo_rastreio || null,
      created_at: p.created_at,
    })),
  })
}
