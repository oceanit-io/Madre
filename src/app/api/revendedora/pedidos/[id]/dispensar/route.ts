// POST /api/revendedora/pedidos/[id]/dispensar
//
// A revendedora descarta um pedido que ficou perpétuo em
// "aguardando_pagamento" no dashboard dela (cliente abriu checkout e
// nunca pagou). Marca o pedido como `cancelado` — o trigger
// pedidos_apos_mudanca_status cancela qualquer comissão associada
// (defesa em profundidade, embora a comissão só seja criada quando
// pedido vai pra 'pago').
//
// Restrições:
//   - Só pode dispensar pedidos do seu próprio subdomínio.
//   - Só pode dispensar se status atual é 'aguardando_pagamento'
//     (trigger pedidos_validar_transicao garante isso).

import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  const { rev, admin } = sessao
  const pedidoId = params.id

  if (!pedidoId) {
    return NextResponse.json({ erro: 'ID do pedido ausente.' }, { status: 400 })
  }

  // Confirma que o pedido pertence à loja dela e está aguardando.
  const { data: pedido } = await admin
    .from('pedidos')
    .select('id, slug_revendedora, status')
    .eq('id', pedidoId)
    .single()

  if (!pedido) {
    return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })
  }
  if (pedido.slug_revendedora !== rev.subdominio) {
    return NextResponse.json({ erro: 'Pedido de outra loja.' }, { status: 403 })
  }
  if (pedido.status !== 'aguardando_pagamento') {
    return NextResponse.json({ erro: 'Pedido não está aguardando pagamento.' }, { status: 400 })
  }

  const { error } = await admin
    .from('pedidos')
    .update({ status: 'cancelado' })
    .eq('id', pedidoId)
    .eq('status', 'aguardando_pagamento') // race guard

  if (error) {
    return NextResponse.json({ erro: 'Falha ao cancelar pedido.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
