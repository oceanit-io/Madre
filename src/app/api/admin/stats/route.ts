import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const supabase = supabaseAdmin()

  // Counts de revendedoras
  const { count: total } = await supabase
    .from('revendedoras')
    .select('*', { count: 'exact', head: true })

  const { count: ativas } = await supabase
    .from('revendedoras')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ativa')

  const { count: pendentes } = await supabase
    .from('revendedoras')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')

  // Vendas e comissões do mês — usa o sistema NOVO (pedidos + comissoes).
  // A tabela `vendas` é legacy do sistema Nuvemshop, ficou vazia.
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  // Pedidos faturados no mês (pago/enviado/entregue → conta como receita).
  const { data: pedidosMes } = await supabase
    .from('pedidos')
    .select('total, status')
    .gte('created_at', inicioMes.toISOString())
    .in('status', ['pago', 'enviado', 'entregue'])

  const peds = pedidosMes || []
  const receita = peds.reduce((acc, p) => acc + Number(p.total || 0), 0)

  // Saldo "pendente" (a pagar/processando p/ revendedoras) — soma de
  // saldo_disponivel + saldo_processando (anti-fraude 20d). Era o
  // que faltava: novas comissões caem em saldo_processando primeiro,
  // não em saldo_disponivel.
  const { data: saldos } = await supabase
    .from('revendedoras')
    .select('saldo_disponivel, saldo_processando')

  const saldoPendente = (saldos || []).reduce(
    (acc, r) =>
      acc +
      Number(r.saldo_disponivel || 0) +
      Number(r.saldo_processando || 0),
    0,
  )

  // Saques solicitados/processando — admin precisa pagar manualmente
  // via PIX/transferência. Banner no /admin mostra quantos + valor total.
  const { data: saquesAbertos } = await supabase
    .from('saques')
    .select('valor, criado_em, status')
    .in('status', ['solicitado', 'processando'])

  const saquesPendentes = saquesAbertos || []
  const saquesValor = saquesPendentes.reduce((s, sq) => s + Number(sq.valor || 0), 0)
  // Saque "atrasado" = aberto há mais de 48h.
  const limiteAtraso = Date.now() - 48 * 3600 * 1000
  const saquesAtrasados = saquesPendentes.filter(s =>
    new Date(s.criado_em).getTime() <= limiteAtraso
  ).length

  // Comissões já liberadas e ainda não pagas (data_liberacao no passado +
  // data_pagamento null). Indica saldo que admin já podia ter pago.
  const hojeISO = new Date().toISOString()
  const { count: comissoesVencidas } = await supabase
    .from('comissoes')
    .select('*', { count: 'exact', head: true })
    .lte('data_liberacao', hojeISO)
    .is('data_pagamento', null)

  return NextResponse.json({
    totalRevendedoras: total || 0,
    revendedorasAtivas: ativas || 0,
    revendedorasPendentes: pendentes || 0,
    vendasMes: peds.length,
    receitaMes: receita,
    saldoPendente,
    saquesPendentesCount: saquesPendentes.length,
    saquesPendentesValor: saquesValor,
    saquesAtrasados,
    comissoesVencidas: comissoesVencidas || 0,
  })
}