// POST /api/admin/excluir-revendedora
//
// Exclui PERMANENTEMENTE uma revendedora. Diferente de /arquivar
// (que só muda status='suspensa'), aqui é hard delete.
//
// Body: { revendedora_id: string, confirmar: string }
//
// Safety checks:
//   - Bloqueia se tiver comissões (preserva histórico financeiro).
//     Pra forçar, admin tem que apagar comissões antes (manual no DB).
//   - Exige "confirmar" = email da revendedora (anti dedo-gordo).
//
// CASCADE delete configurado no DB pra: vendas, saques, notificacoes,
// mensalidades_pagamentos. Auth.users deletado via admin API.

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
  const confirmar = (body?.confirmar || '').toString().trim().toLowerCase()

  if (!revendedora_id) {
    return NextResponse.json({ erro: 'revendedora_id obrigatório' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  // Busca a revendedora
  const { data: rev } = await supabase
    .from('revendedoras')
    .select('id, nome, email, user_id')
    .eq('id', revendedora_id)
    .maybeSingle()

  if (!rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  // Confirmação anti-acidente: tem que digitar o email da revendedora
  if (confirmar !== rev.email.toLowerCase()) {
    return NextResponse.json({
      erro: `Pra confirmar, digite o email da revendedora: ${rev.email}`,
    }, { status: 400 })
  }

  // Bloqueia se tiver comissões (preserva histórico financeiro)
  const { count: temComissoes } = await supabase
    .from('comissoes')
    .select('*', { count: 'exact', head: true })
    .eq('revendedora_id', revendedora_id)

  if (temComissoes && temComissoes > 0) {
    return NextResponse.json({
      erro: `Não posso excluir: tem ${temComissoes} comissão(ões) registradas. Histórico financeiro deve ser preservado. Use "Arquivar" em vez disso.`,
    }, { status: 409 })
  }

  // Apaga do auth.users primeiro (se tiver user_id) — MAS só se nenhuma
  // OUTRA revendedora apontar pro mesmo auth user. Já aconteceu de 2 cadastros
  // (mesmo email, "P" maiúsculo vs minúsculo) compartilharem o mesmo auth user;
  // apagar esse user fazia o CASCADE levar a OUTRA loja junto (perda de dados).
  // Defesa em profundidade: o índice único de email agora impede o duplicado,
  // mas mesmo assim não apagamos o auth user se ele ainda for usado por alguém.
  if (rev.user_id) {
    const { count: outrosComMesmoUser } = await supabase
      .from('revendedoras')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', rev.user_id as string)
      .neq('id', revendedora_id)

    if (outrosComMesmoUser && outrosComMesmoUser > 0) {
      console.warn(`[excluir-revendedora] auth user ${rev.user_id} compartilhado por ${outrosComMesmoUser} outra(s) revendedora(s) — NÃO apagando o auth user pra não derrubar elas.`)
    } else {
      const { error: authErr } = await supabase.auth.admin.deleteUser(rev.user_id as string)
      if (authErr) {
        console.warn('[excluir-revendedora] auth delete falhou (ignorando):', authErr.message)
        // Não bloqueia — pode ser que o user_id já tenha sido apagado antes.
      }
    }
  }

  // Apaga da tabela revendedoras (CASCADE handles vendas/saques/etc)
  const { error: delErr } = await supabase
    .from('revendedoras')
    .delete()
    .eq('id', revendedora_id)

  if (delErr) {
    return NextResponse.json({
      erro: `Falha ao excluir: ${delErr.message}`,
    }, { status: 500 })
  }

  await logAdminAction({
    request,
    acao: 'excluir_revendedora',
    alvo: revendedora_id,
    detalhes: { nome: rev.nome, email: rev.email },
  })

  return NextResponse.json({
    ok: true,
    nome: rev.nome,
    email: rev.email,
  })
}
