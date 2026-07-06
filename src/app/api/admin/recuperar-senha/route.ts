import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminAudit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Admin dispara o e-mail de recuperação de senha em nome de qualquer
// revendedora. Útil pra suporte quando a usuária não consegue acessar
// o fluxo /auth/esqueci-senha por conta própria.
//
// Envia via Supabase Auth (mesmo fluxo do /auth/esqueci-senha cliente);
// o link aponta pra /auth/redefinir-senha no domínio canônico.
export async function POST(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const email = (body.email || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erro: 'E-mail inválido' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || 'https://lojadeprata925.com.br'
  ).replace(/\/$/, '')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/redefinir-senha`,
  })

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao enviar e-mail', detalhes: error.message },
      { status: 500 }
    )
  }

  await logAdminAction({
    request: req,
    acao: 'recuperar_senha',
    alvo: email,
  })

  return NextResponse.json({ ok: true, email })
}
