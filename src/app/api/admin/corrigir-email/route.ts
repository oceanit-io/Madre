// POST /api/admin/corrigir-email
//
// Corrige o e-mail de uma revendedora — útil quando ela se cadastrou
// com typo (ex: Edna com @gmail.comom) e não consegue entrar nem
// receber emails. Atualiza tanto a tabela `revendedoras` quanto o
// `auth.users.email` no Supabase Auth (que é onde o login acontece).
//
// Body:
//   { revendedora_id: string, novo_email: string }
//
// Retorna:
//   { ok: true, email_antigo, email_novo } | { erro: string }

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validarEmail } from '@/lib/emailValidator'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const revendedora_id = (body?.revendedora_id || '').toString().trim()
  const novo_email = (body?.novo_email || '').toString().trim().toLowerCase()

  if (!revendedora_id) {
    return NextResponse.json({ erro: 'revendedora_id obrigatório' }, { status: 400 })
  }
  if (!novo_email) {
    return NextResponse.json({ erro: 'novo_email obrigatório' }, { status: 400 })
  }

  // Valida o novo email (rejeita .comom, .comm etc)
  const errEmail = validarEmail(novo_email)
  if (errEmail) {
    return NextResponse.json({ erro: errEmail }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  // 1. Busca a revendedora pra pegar user_id e email atual
  const { data: rev, error: revErr } = await supabase
    .from('revendedoras')
    .select('id, user_id, email, nome')
    .eq('id', revendedora_id)
    .maybeSingle()

  if (revErr || !rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }

  if (rev.email === novo_email) {
    return NextResponse.json({ erro: 'O novo e-mail é igual ao atual' }, { status: 400 })
  }

  // 2. Checa se já existe outra revendedora com esse email
  const { data: jaExiste } = await supabase
    .from('revendedoras')
    .select('id')
    .ilike('email', novo_email)
    .neq('id', revendedora_id)
    .maybeSingle()

  if (jaExiste) {
    return NextResponse.json({ erro: 'Esse e-mail já está em uso por outra revendedora' }, { status: 409 })
  }

  // 3. Atualiza no Supabase Auth (fonte de verdade do login)
  if (rev.user_id) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(
      rev.user_id as string,
      { email: novo_email, email_confirm: true }
    )
    if (authErr) {
      return NextResponse.json({
        erro: `Falha no Auth: ${authErr.message}`,
      }, { status: 500 })
    }
  }

  // 4. Atualiza na tabela revendedoras
  const { error: updErr } = await supabase
    .from('revendedoras')
    .update({ email: novo_email })
    .eq('id', revendedora_id)

  if (updErr) {
    return NextResponse.json({
      erro: `Falha na tabela revendedoras: ${updErr.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    email_antigo: rev.email,
    email_novo: novo_email,
    nome: rev.nome,
  })
}
