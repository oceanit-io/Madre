import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Admin DEFINE direto uma nova senha pra qualquer revendedora (sem mandar
// e-mail de recuperação). Usa a Auth Admin API (service_role). Útil pra
// suporte quando a revendedora não consegue receber/usar o link.
export async function POST(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: { revendedora_id?: string; nova_senha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const revendedora_id = (body.revendedora_id || '').trim()
  const novaSenha = (body.nova_senha || '').trim()

  if (!revendedora_id) {
    return NextResponse.json({ erro: 'revendedora_id obrigatório' }, { status: 400 })
  }
  if (novaSenha.length < 6) {
    return NextResponse.json({ erro: 'A senha precisa ter ao menos 6 caracteres' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: rev, error: e1 } = await supabase
    .from('revendedoras')
    .select('id, nome, email, user_id')
    .eq('id', revendedora_id)
    .single()

  if (e1 || !rev || !rev.user_id) {
    return NextResponse.json({ erro: 'Revendedora ou usuário não encontrado' }, { status: 404 })
  }

  const { error: e2 } = await supabase.auth.admin.updateUserById(rev.user_id, {
    password: novaSenha,
  })

  if (e2) {
    return NextResponse.json(
      { erro: 'Erro ao definir senha', detalhes: e2.message },
      { status: 500 }
    )
  }

  // Audit: NÃO loga a senha em texto plano.
  await logAdminAction({
    request: req,
    acao: 'definir_senha',
    alvo: rev.email,
    detalhes: { nome: rev.nome },
  })

  return NextResponse.json({ ok: true, nome: rev.nome, email: rev.email })
}
