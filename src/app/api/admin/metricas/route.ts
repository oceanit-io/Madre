import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { ABANDONO_HORAS } from '@/lib/pedidoStatus'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)
  const limiteAbandono = new Date(Date.now() - ABANDONO_HORAS * 3600 * 1000)

  // Vendas hoje: soma do total dos pedidos pago/enviado/entregue criados hoje
  const { data: vendas } = await supabase
    .from('pedidos')
    .select('total')
    .gte('created_at', inicioHoje.toISOString())
    .in('status', ['pago', 'enviado', 'entregue'])

  const vendas_hoje = (vendas || []).reduce((acc, p) => acc + Number(p.total || 0), 0)

  // Pedidos criados hoje
  const { count: pedidos_hoje } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', inicioHoje.toISOString())

  // Aguardando pagamento (ainda dentro das 48h)
  const { count: aguardando_pagamento } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aguardando_pagamento')
    .gte('created_at', limiteAbandono.toISOString())

  // Abandonados (aguardando pagamento há mais de 48h)
  const { count: abandonados } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aguardando_pagamento')
    .lt('created_at', limiteAbandono.toISOString())

  // ---------- Funil de vendas (últimos 30 dias) ----------
  // Indicador de conversão + quanto $ está escapando em pedidos não pagos.
  const inicio30d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const { data: ultimos } = await supabase
    .from('pedidos')
    .select('status, total')
    .gte('created_at', inicio30d.toISOString())

  const PAGOS = ['pago', 'enviado', 'entregue']
  let criados = 0
  let pagos = 0
  let pendentes = 0
  let cancelados = 0
  let valor_pago = 0
  let valor_perdido = 0
  for (const p of ultimos || []) {
    criados++
    const t = Number(p.total || 0)
    if (PAGOS.includes(p.status)) {
      pagos++
      valor_pago += t
    } else if (p.status === 'aguardando_pagamento') {
      pendentes++
      valor_perdido += t
    } else if (p.status === 'cancelado') {
      cancelados++
    }
  }
  const conversao = criados > 0 ? Math.round((pagos / criados) * 1000) / 10 : 0

  return NextResponse.json({
    vendas_hoje,
    pedidos_hoje: pedidos_hoje || 0,
    aguardando_pagamento: aguardando_pagamento || 0,
    abandonados: abandonados || 0,
    funil30d: {
      criados,
      pagos,
      pendentes,
      cancelados,
      valor_pago: Math.round(valor_pago * 100) / 100,
      valor_perdido: Math.round(valor_perdido * 100) / 100,
      conversao,
    },
  })
}
