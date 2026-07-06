// POST /api/pedidos/[id]/pix
//
// Cria order PIX direto no Pagar.me via /v5/orders com split 3-way (rev +
// Prata15 + conta mãe). PIX por /orders aceita split — paymentlink não.
//
// Idempotente: se o pedido já tem `pagarme_order_id` salvo, retorna o
// QR/copia-e-cola existente sem chamar Pagar.me de novo (não precisa
// pagar 2 vezes; o cliente pode atualizar a página e o QR continua
// válido até expirar).
//
// Recalcula tudo do lado server (subtotal, frete, comissão, split) —
// nunca confia em valor vindo do client.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { criarPixPagarme, pagarmeHabilitado, REVENDEDORA_VIA_SPLIT } from '@/lib/pagarme'

export const dynamic = 'force-dynamic'

type PedidoRow = {
  id: string
  numero_pedido: string
  status: string
  cliente_nome: string
  cliente_email: string
  cliente_telefone: string | null
  cliente_cpf: string | null
  slug_revendedora: string | null
  subtotal: number | string
  frete: number | string
  total: number | string
  itens: unknown
  endereco_cep: string | null
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_uf: string | null
  pagarme_order_id: string | null
  pagarme_charge_id: string | null
  pix_qr_code: string | null
  pix_qr_code_url: string | null
  pix_expira_em: string | null
}

type ItemPedido = { nome?: string; preco?: number; quantidade?: number }

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!pagarmeHabilitado()) {
    return NextResponse.json(
      { erro: 'Pagamento online indisponível no momento.' },
      { status: 503 }
    )
  }

  const admin = supabaseAdmin()
  const { data: pedidoRaw } = await admin
    .from('pedidos')
    .select(
      'id, numero_pedido, status, cliente_nome, cliente_email, cliente_telefone, cliente_cpf, slug_revendedora, subtotal, frete, total, itens, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, pagarme_order_id, pagarme_charge_id, pix_qr_code, pix_qr_code_url, pix_expira_em'
    )
    .eq('id', params.id)
    .single()

  const pedido = pedidoRaw as PedidoRow | null
  if (!pedido) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404 })

  if (pedido.status !== 'aguardando_pagamento') {
    return NextResponse.json(
      { erro: 'Pedido não está aguardando pagamento.', status: pedido.status },
      { status: 400 }
    )
  }

  // Idempotência: se já gerou um PIX antes, devolve o mesmo.
  if (pedido.pagarme_order_id && pedido.pix_qr_code && pedido.pix_qr_code_url) {
    return NextResponse.json({
      orderId: pedido.pagarme_order_id,
      chargeId: pedido.pagarme_charge_id || '',
      qrCodeUrl: pedido.pix_qr_code_url,
      copiaECola: pedido.pix_qr_code,
      expiraEm: pedido.pix_expira_em || '',
    })
  }

  // Resolve revendedora (recipient + status) pelo slug.
  let revRecipientId = ''
  let revRecipientStatus: string | null = null
  if (pedido.slug_revendedora) {
    const { data: rev } = await admin
      .from('revendedoras')
      .select('pagarme_recipient_id, pagarme_recipient_status')
      .eq('subdominio', pedido.slug_revendedora)
      .single()
    revRecipientId = (rev?.pagarme_recipient_id as string) || ''
    revRecipientStatus = (rev?.pagarme_recipient_status as string) || null
  }

  const REV_PERCENT = Number(process.env.PAGARME_REVENDEDORA_PERCENT) || 0.30
  const PRATA15_PERCENT = Number(process.env.PAGARME_PRATA15_PERCENT) || 0.695
  const prata15RecipientId = process.env.PAGARME_PRATA15_RECIPIENT_ID || ''
  const mainAccountRecipientId = process.env.PAGARME_MAIN_RECIPIENT_ID || ''
  // Revendedora só entra no split se REVENDEDORA_VIA_SPLIT (hoje false → ela é
  // paga pelo modelo interno de 20 dias, não pelo split direto).
  const revAtiva = REVENDEDORA_VIA_SPLIT && !!(revRecipientId && revRecipientStatus === 'active')

  const subtotal = Number(pedido.subtotal || 0)
  const frete = Number(pedido.frete || 0)
  const total = Number(pedido.total || 0)
  const subtotalCent = Math.round(subtotal * 100)
  const freteCent = Math.round(frete * 100)
  const totalCent = subtotalCent + freteCent
  const comissaoCent = revAtiva ? Math.round(subtotalCent * REV_PERCENT) : 0
  const prata15Cent = prata15RecipientId
    ? Math.round(subtotalCent * PRATA15_PERCENT) + freteCent
    : 0
  const mainAccountCent = mainAccountRecipientId
    ? totalCent - comissaoCent - prata15Cent
    : 0

  const splitConfig: {
    revendedoraRecipientId?: string
    comissaoCentavos?: number
    prata15RecipientId?: string
    prata15Centavos?: number
    mainAccountRecipientId?: string
    mainAccountCentavos?: number
  } = {}
  if (mainAccountRecipientId && mainAccountCent > 0) {
    if (revAtiva && revRecipientId && comissaoCent > 0) {
      splitConfig.revendedoraRecipientId = revRecipientId
      splitConfig.comissaoCentavos = comissaoCent
    }
    if (prata15RecipientId && prata15Cent > 0) {
      splitConfig.prata15RecipientId = prata15RecipientId
      splitConfig.prata15Centavos = prata15Cent
    }
    splitConfig.mainAccountRecipientId = mainAccountRecipientId
    splitConfig.mainAccountCentavos = mainAccountCent
  }

  // Items: do JSON guardado em pedido. Pagar.me precisa de pelo menos
  // 1 item com amount + quantity. Se o JSON estiver vazio/inválido,
  // o helper cai num fallback (1 item com o total).
  let itens: ItemPedido[] = []
  if (Array.isArray(pedido.itens)) itens = pedido.itens as ItemPedido[]
  else if (typeof pedido.itens === 'string') {
    try { itens = JSON.parse(pedido.itens) as ItemPedido[] } catch { /* */ }
  }

  const resultado = await criarPixPagarme({
    numeroPedido: pedido.numero_pedido,
    total,
    cliente: {
      nome: pedido.cliente_nome || '',
      email: pedido.cliente_email || '',
      telefone: pedido.cliente_telefone || '',
      cpf: pedido.cliente_cpf || '',
    },
    itens: itens.map(i => ({
      nome: String(i.nome || 'Item'),
      preco: Number(i.preco || 0),
      quantidade: Number(i.quantidade || 1),
    })),
    split: Object.keys(splitConfig).length > 0 ? splitConfig : undefined,
    endereco: pedido.endereco_cep
      ? {
          cep: pedido.endereco_cep,
          rua: pedido.endereco_rua || '',
          numero: pedido.endereco_numero || '',
          complemento: pedido.endereco_complemento || '',
          bairro: pedido.endereco_bairro || '',
          cidade: pedido.endereco_cidade || '',
          uf: pedido.endereco_uf || '',
        }
      : undefined,
  })

  if (!resultado) {
    return NextResponse.json(
      { erro: 'Não foi possível gerar o PIX agora. Tente o cartão ou WhatsApp.' },
      { status: 502 }
    )
  }

  // Salva no pedido pra idempotência futura.
  // comissao_via_split: se a revendedora entrou no split real (KYC ativo), os
  // 30% caem DIRETO na conta dela agora — então o trigger NÃO deve creditar
  // saldo depois (senão pagava 2x). revAtiva é a fonte de verdade do split.
  await admin
    .from('pedidos')
    .update({
      pagarme_order_id: resultado.orderId || null,
      pagarme_charge_id: resultado.chargeId || null,
      pix_qr_code: resultado.copiaECola,
      pix_qr_code_url: resultado.qrCodeUrl,
      pix_expira_em: resultado.expiraEm || null,
      comissao_via_split: revAtiva,
    })
    .eq('id', pedido.id)

  return NextResponse.json(resultado)
}
