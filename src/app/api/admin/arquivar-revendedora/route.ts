// POST /api/admin/arquivar-revendedora
//
// Arquiva (status='suspensa') uma revendedora que nunca ativou. Útil
// pra limpar a lista de pendentes que não pagaram e provavelmente
// não vão pagar mais.
//
// Body: { revendedora_id: string, motivo?: string }
//
// NÃO deleta o registro — preserva pra histórico (caso a pessoa
// volte um dia). Só muda status pra 'suspensa', que esconde do
// fluxo normal mas mantém auditoria.
//
// Quem quiser realmente excluir, é endpoint separado /excluir
// (TBD — não implementado, exige cuidado com FK).

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const revendedora_id = (body?.revendedora_id || '').toString().trim()
  if (!revendedora_id) {
    return NextResponse.json({ erro: 'revendedora_id obrigatório' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const { data: rev, error: revErr } = await supabase
    .from('revendedoras')
    .select('id, nome, email, status')
    .eq('id', revendedora_id)
    .maybeSingle()

  if (revErr || !rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }
  if (rev.status === 'suspensa') {
    return NextResponse.json({ erro: 'Já está arquivada' }, { status: 400 })
  }

  const { error: updErr } = await supabase
    .from('revendedoras')
    .update({ status: 'suspensa' })
    .eq('id', revendedora_id)

  if (updErr) {
    return NextResponse.json({
      erro: `Falha ao arquivar: ${updErr.message}`,
    }, { status: 500 })
  }

  await logAdminAction({
    request,
    acao: 'arquivar_revendedora',
    alvo: revendedora_id,
    detalhes: { nome: rev.nome, email: rev.email, status_anterior: rev.status },
  })

  return NextResponse.json({
    ok: true,
    nome: rev.nome,
    email: rev.email,
    status_anterior: rev.status,
  })
}
