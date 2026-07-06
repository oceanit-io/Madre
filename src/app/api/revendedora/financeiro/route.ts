import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'
import { calcularTotais } from '@/lib/comissoesCalc'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const { rev, admin } = sessao

  // Comissões da revendedora: por id resolvido OU por slug (pendentes
  // ainda não resolvidas que pertencem ao seu subdomínio).
  const { data: comissoesRaw } = await admin
    .from('comissoes')
    .select(
      'id, pedido_id, valor_base, percentual, valor_comissao, status, data_liberacao, data_pagamento, created_at'
    )
    .or(`revendedora_id.eq.${rev.id},slug_revendedora.eq.${rev.subdominio}`)
    .order('created_at', { ascending: false })

  const comissoes = comissoesRaw || []

  // Dados do pedido (numero + cliente) para exibir na lista.
  const pedidoIds = Array.from(
    new Set(comissoes.map(c => c.pedido_id).filter(Boolean))
  ) as string[]

  const mapaPedido = new Map<
    string,
    { numero_pedido: string; cliente_nome: string; created_at: string }
  >()

  if (pedidoIds.length > 0) {
    const { data: peds } = await admin
      .from('pedidos')
      .select('id, numero_pedido, cliente_nome, created_at')
      .in('id', pedidoIds)
    for (const p of peds || []) {
      mapaPedido.set(p.id, {
        numero_pedido: p.numero_pedido,
        cliente_nome: p.cliente_nome,
        created_at: p.created_at,
      })
    }
  }

  const { data: saquesRaw } = await admin
    .from('saques')
    .select('valor, status')
    .eq('revendedora_id', rev.id)

  const saques = saquesRaw || []

  // Pedidos da loja dela ainda aguardando pagamento — pra recuperar
  // venda manualmente via WhatsApp. Não é "carrinho" puro (esses vivem
  // só em localStorage); são checkouts iniciados que não pagaram.
  const { data: aguardandoRaw } = await admin
    .from('pedidos')
    .select('id, numero_pedido, cliente_nome, cliente_telefone, total, created_at')
    .eq('slug_revendedora', rev.subdominio)
    .eq('status', 'aguardando_pagamento')
    .order('created_at', { ascending: false })
    .limit(30)

  const pedidosAguardando = (aguardandoRaw || []).map(p => ({
    id: p.id as string,
    numero_pedido: (p.numero_pedido as string) || null,
    cliente_nome: (p.cliente_nome as string) || null,
    cliente_telefone: (p.cliente_telefone as string) || null,
    total: Number(p.total || 0),
    created_at: p.created_at as string,
  }))

  const totais = calcularTotais(
    rev.saldo_disponivel,
    rev.saldo_processando,
    comissoes,
    saques
  )

  const comissoesView = comissoes.map(c => {
    const ped = c.pedido_id ? mapaPedido.get(c.pedido_id) : undefined
    return {
      id: c.id,
      numero_pedido: ped?.numero_pedido || null,
      cliente_nome: ped?.cliente_nome || null,
      valor_base: Number(c.valor_base || 0),
      percentual: Number(c.percentual || 0),
      valor_comissao: Number(c.valor_comissao || 0),
      status: c.status,
      data_liberacao: c.data_liberacao,
      created_at: c.created_at,
    }
  })

  return NextResponse.json({
    revendedora: {
      nome: rev.nome,
      nome_loja: rev.nome_loja,
      subdominio: rev.subdominio,
      status: rev.status,
      pagarme_recipient_id: rev.pagarme_recipient_id,
      pagarme_recipient_status: rev.pagarme_recipient_status,
    },
    totais,
    comissoes: comissoesView,
    pedidosAguardando,
  })
}
