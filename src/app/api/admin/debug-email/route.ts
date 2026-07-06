import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { enviarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Endpoint temporário p/ diagnosticar entrega de e-mail.
// GET → mostra config (sem expor valores secretos).
// POST { to, subject? } → envia um e-mail de teste e retorna o resultado da Resend.
// Bearer prata925.
export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  return NextResponse.json({
    resend_api_key_set: !!apiKey,
    resend_api_key_prefix: apiKey ? apiKey.slice(0, 8) + '…' : null,
    email_from: from || '(não setado — fallback p/ onboarding@resend.dev)',
    email_from_domain: from
      ? (from.match(/@([^>]+)/)?.[1] || 'parse erro')
      : 'onboarding@resend.dev (entrega só ao dono da conta Resend)',
  })
}

export async function POST(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  let body: { to?: string; subject?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }
  if (!body.to) return NextResponse.json({ erro: 'to obrigatório' }, { status: 400 })

  const r = await enviarEmail({
    to: body.to,
    subject: body.subject || 'Teste Prata 925 — pode ignorar',
    html: '<p>Esse é um e-mail de teste do Prata 925. Se você está vendo, a entrega está funcionando ✅</p>',
  })

  return NextResponse.json({
    resend_response: r,
    from_used: process.env.EMAIL_FROM || 'Prata 925 <onboarding@resend.dev>',
    to: body.to,
  })
}
