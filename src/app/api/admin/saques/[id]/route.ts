// PATCH /api/admin/saques/[id]  body: { acao: 'processar'|'pagar'|'recusar' }
//
// Transições permitidas:
//   solicitado    → processando | recusado
//   processando   → pago        | recusado
//   pago / recusado → (terminal)
//
// Recusa: devolve o valor pro saldo_disponivel da revendedora.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const admin = supabaseAdmin()

  let body: { acao?: string } = {}
  try { body = await request.json() } catch { /* */ }
  const acao = body.acao || ''

  const { data: saque } = await admin
    .from('saques')
    .select('id, status, valor, revendedora_id')
    .eq('id', params.id)
    .single()

  if (!saque) return NextResponse.json({ erro: 'Saque não encontrado' }, { status: 404 })

  const valor = Number(saque.valor || 0)
  let novoStatus = ''

  if (acao === 'processar' && saque.status === 'solicitado') {
    novoStatus = 'processando'
  } else if (acao === 'pagar' && (saque.status === 'solicitado' || saque.status === 'processando')) {
    novoStatus = 'pago'
  } else if (acao === 'recusar' && (saque.status === 'solicitado' || saque.status === 'processando')) {
    novoStatus = 'recusado'
    if (saque.revendedora_id) {
      const { data: rev } = await admin
        .from('revendedoras')
        .select('saldo_disponivel')
        .eq('id', saque.revendedora_id)
        .single()
      const saldo = Number(rev?.saldo_disponivel || 0)
      await admin
        .from('revendedoras')
        .update({ saldo_disponivel: saldo + valor })
        .eq('id', saque.revendedora_id)
    }
  } else {
    return NextResponse.json({ erro: `Ação inválida pra status atual (${saque.status})` }, { status: 400 })
  }

  const update: Record<string, unknown> = { status: novoStatus }
  if (novoStatus === 'pago') update.pago_em = new Date().toISOString()

  const { error } = await admin.from('saques').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  if (novoStatus === 'pago' || novoStatus === 'recusado') {
    await admin.from('notificacoes').insert({
      revendedora_id: saque.revendedora_id,
      titulo: novoStatus === 'pago' ? 'Saque pago' : 'Saque recusado',
      mensagem: novoStatus === 'pago'
        ? `Seu saque de R$ ${valor.toFixed(2).replace('.', ',')} foi pago.`
        : `Seu saque de R$ ${valor.toFixed(2).replace('.', ',')} foi recusado. O valor voltou pro seu saldo.`,
      tipo: 'saque',
    }).then(() => undefined, () => undefined)
  }

  await logAdminAction({
    request,
    acao: `saque_${novoStatus}`,
    alvo: params.id,
    detalhes: { valor, revendedora_id: saque.revendedora_id },
  })

  return NextResponse.json({ ok: true, status: novoStatus })
}
