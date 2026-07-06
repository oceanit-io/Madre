// PATCH /api/revendedora/pedidos/[id]/rastreio
//
// Atualiza o código de rastreamento dos Correios de um pedido.
// Só a revendedora dona do pedido pode atualizar (RLS via slug).
//
// Body: { codigo_rastreio: string } — pode ser '' pra limpar
//
// Retorna: { ok: true, codigo_rastreio: string | null }

import { NextResponse } from 'next/server'
import { getRevendedoraFromRequest } from '@/lib/revendedoraAuth'
import { emailRastreioAoCliente } from '@/lib/pedidoEmails'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const sessao = await getRevendedoraFromRequest(request)
  if (!sessao) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: { codigo_rastreio?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const codigo = (body.codigo_rastreio || '').trim().toUpperCase()
  // Correios: 13 chars (2 letras + 9 dígitos + BR), aceitamos formato livre
  // pra não bloquear se Correios mudar formato no futuro.
  if (codigo.length > 50) {
    return NextResponse.json({ erro: 'Código muito longo (máx 50)' }, { status: 400 })
  }

  // Garante que o pedido é da loja desta revendedora antes de atualizar.
  // Puxa também os dados do cliente p/ avisar do rastreio por e-mail.
  const { data: pedido } = await sessao.admin
    .from('pedidos')
    .select('id, slug_revendedora, codigo_rastreio, cliente_email, cliente_nome, numero_pedido')
    .eq('id', params.id)
    .maybeSingle()

  if (!pedido || pedido.slug_revendedora !== sessao.rev.subdominio) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  const valor = codigo || null
  const { error } = await sessao.admin
    .from('pedidos')
    .update({ codigo_rastreio: valor })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  // Avisa o CLIENTE por e-mail SÓ quando o código é novo ou mudou (evita
  // reenviar a cada save). Best-effort: a função nunca lança, então um e-mail
  // que falha não quebra o update do rastreio.
  const codigoAnterior = (pedido.codigo_rastreio || '').trim().toUpperCase()
  if (valor && valor !== codigoAnterior) {
    await emailRastreioAoCliente(sessao.admin, {
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      cliente_nome: pedido.cliente_nome,
      cliente_email: pedido.cliente_email,
      total: null,
      slug_revendedora: pedido.slug_revendedora,
      codigo_rastreio: valor,
    })
  }

  return NextResponse.json({ ok: true, codigo_rastreio: valor })
}
