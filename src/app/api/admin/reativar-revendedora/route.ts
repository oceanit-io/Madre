// POST /api/admin/reativar-revendedora
//
// Tira o status 'suspensa' e devolve pra 'pendente' (pra ela poder
// pagar) ou direto 'ativa' (se admin quiser ativar de uma vez).
//
// Body: { revendedora_id: string, para?: 'pendente' | 'ativa' }
// Default: 'pendente'

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
  const para = (body?.para === 'ativa' ? 'ativa' : 'pendente') as 'ativa' | 'pendente'

  if (!revendedora_id) {
    return NextResponse.json({ erro: 'revendedora_id obrigatório' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const { data: rev } = await supabase
    .from('revendedoras')
    .select('id, nome, status')
    .eq('id', revendedora_id)
    .maybeSingle()

  if (!rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  const { error } = await supabase
    .from('revendedoras')
    .update({ status: para })
    .eq('id', revendedora_id)

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  await logAdminAction({
    request,
    acao: 'reativar_revendedora',
    alvo: revendedora_id,
    detalhes: { nome: rev.nome, status: para, status_anterior: rev.status },
  })

  return NextResponse.json({ ok: true, nome: rev.nome, status: para })
}
