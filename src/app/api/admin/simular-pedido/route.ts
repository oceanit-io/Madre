import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { REVENDEDORA_VIA_SPLIT } from '@/lib/pagarme'

export const dynamic = 'force-dynamic'

// Simula a montagem do split exatamente como /api/pedidos faria,
// SEM criar pedido nem chamar Pagar.me. Retorna o objeto split que
// seria enviado, com explicação por que cada regra entrou ou não.
//
// GET /api/admin/simular-pedido?slug=...&subtotal=29.9&frete=11.15
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') || ''
  const subtotal = Number(url.searchParams.get('subtotal') || '29.90')
  const frete = Number(url.searchParams.get('frete') || '11.15')

  const admin = supabaseAdmin()
  const { data: rev } = await admin
    .from('revendedoras')
    .select('nome, pagarme_recipient_id, pagarme_recipient_status')
    .eq('subdominio', slug)
    .single()

  const revRecipientId = (rev?.pagarme_recipient_id as string) || null
  const revRecipientStatus = (rev?.pagarme_recipient_status as string) || null

  const REV_PERCENT = Number(process.env.PAGARME_REVENDEDORA_PERCENT) || 0.30
  const PRATA15_PERCENT = Number(process.env.PAGARME_PRATA15_PERCENT) || 0.695
  const prata15RecipientId = process.env.PAGARME_PRATA15_RECIPIENT_ID || ''
  const mainAccountRecipientId = process.env.PAGARME_MAIN_RECIPIENT_ID || ''
  const revAtiva = REVENDEDORA_VIA_SPLIT && !!(revRecipientId && revRecipientStatus === 'active')

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

  const splitConfig: Record<string, unknown> = {}
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

  const seriaAplicado = Object.keys(splitConfig).length > 0
  const fmt = (cents: number) => `R$ ${(cents/100).toFixed(2).replace('.', ',')}`

  return NextResponse.json({
    inputs: {
      slug,
      subtotal,
      frete,
      total: subtotal + frete,
    },
    rev_do_db: {
      nome: rev?.nome,
      pagarme_recipient_id: revRecipientId,
      pagarme_recipient_status: revRecipientStatus,
    },
    envs: {
      PAGARME_REVENDEDORA_PERCENT: REV_PERCENT,
      PAGARME_PRATA15_PERCENT: PRATA15_PERCENT,
      PAGARME_PRATA15_RECIPIENT_ID_setada: !!prata15RecipientId,
      PAGARME_MAIN_RECIPIENT_ID_setada: !!mainAccountRecipientId,
    },
    computados: {
      subtotalCent,
      freteCent,
      totalCent,
      revAtiva,
      comissaoCent,
      prata15Cent,
      mainAccountCent,
      seria_aplicado_split: seriaAplicado,
    },
    splitConfig,
    breakdown: {
      revendedora: revAtiva
        ? `${fmt(comissaoCent)} (${REV_PERCENT * 100}% subtotal)`
        : 'R$ 0,00 — rev não ativa, sua parte vai pra conta mãe',
      prata15: prata15RecipientId
        ? `${fmt(prata15Cent)} (${PRATA15_PERCENT * 100}% subtotal + frete inteiro)`
        : 'R$ 0,00 — env não setada, parte vai pra conta mãe',
      conta_mae: mainAccountRecipientId
        ? `${fmt(mainAccountCent)} (resto — flags charge_remainder/processing_fee/liable=true)`
        : '⚠️ NÃO setada — split NÃO vai funcionar (Pagar.me rejeita sem ela)',
      total_check: `${fmt(comissaoCent + prata15Cent + mainAccountCent)} (deve bater com ${fmt(totalCent)})`,
    },
    veredito: seriaAplicado
      ? '✅ Split 3-way OK — quando este pedido for pago via cartão (paymentlink) ou PIX (/v5/orders), Pagar.me vai dividir entre os 3 recipients.'
      : mainAccountRecipientId
        ? '⚠️ Sem regras explícitas — vai 100% pra conta mãe via default.'
        : '🔴 PAGARME_MAIN_RECIPIENT_ID FALTANDO — sem split em hipótese alguma.',
  })
}
