import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { MENSALIDADE_VALOR, novoVencimento } from '@/lib/mensalidade'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Acao = 'pagar' | 'debitar_saldo' | 'isentar' | 'cobrar' | 'suspender' | 'reativar'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  let body: { acao?: Acao }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }
  const acao = body.acao

  const supabase = supabaseAdmin()

  const { data: rev, error: errRev } = await supabase
    .from('revendedoras')
    .select('id, status, saldo_disponivel, mensalidade_vence_em, mensalidade_isento')
    .eq('id', params.id)
    .single()

  if (errRev || !rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  let logar: { metodo: string; vence: string } | null = null

  if (acao === 'pagar' || acao === 'debitar_saldo') {
    const vence = novoVencimento(rev.mensalidade_vence_em)

    if (acao === 'debitar_saldo') {
      const saldo = Number(rev.saldo_disponivel || 0)
      if (saldo < MENSALIDADE_VALOR) {
        return NextResponse.json(
          { erro: `Saldo insuficiente (R$ ${saldo.toFixed(2)} < R$ ${MENSALIDADE_VALOR.toFixed(2)})` },
          { status: 400 }
        )
      }
      update.saldo_disponivel = Math.round((saldo - MENSALIDADE_VALOR) * 100) / 100
    }

    update.mensalidade_vence_em = vence
    if (rev.status === 'suspensa') update.status = 'ativa'
    logar = { metodo: acao === 'debitar_saldo' ? 'saldo' : 'manual', vence }
  } else if (acao === 'isentar') {
    update.mensalidade_isento = true
  } else if (acao === 'cobrar') {
    update.mensalidade_isento = false
  } else if (acao === 'suspender') {
    update.status = 'suspensa'
  } else if (acao === 'reativar') {
    update.status = 'ativa'
  } else {
    return NextResponse.json({ erro: 'Ação inválida' }, { status: 400 })
  }

  const { error: errUpd } = await supabase
    .from('revendedoras')
    .update(update)
    .eq('id', params.id)

  if (errUpd) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar', detalhes: errUpd.message },
      { status: 500 }
    )
  }

  if (logar) {
    await supabase.from('mensalidades_pagamentos').insert({
      revendedora_id: params.id,
      valor: MENSALIDADE_VALOR,
      metodo: logar.metodo,
      vence_novo: logar.vence,
      created_by: 'admin',
    })
    // Notificação motivacional pra revendedora
    await supabase.from('notificacoes').insert({
      revendedora_id: params.id,
      titulo: '💎 Mensalidade em dia!',
      mensagem: `Tudo certo! Sua loja Prata 925 está ativa e garantida até ${logar.vence
        .split('-')
        .reverse()
        .join('/')}. Bora vender muito! 🚀`,
      tipo: 'info',
    })
  }

  await logAdminAction({
    request,
    acao: `mensalidade_${acao}`,
    alvo: params.id,
    detalhes: logar ? { metodo: logar.metodo, vence: logar.vence } : null,
  })

  return NextResponse.json({ ok: true })
}
