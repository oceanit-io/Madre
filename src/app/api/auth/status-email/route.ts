// POST /api/auth/status-email — checa status de cadastro de um email.
//
// Usado pelo /auth/register quando Supabase retorna "already registered".
// Em vez de mostrar erro genérico, descobrimos se a pessoa só não pagou
// ainda (pendente), se já tá ativa (manda pro login) ou se foi suspensa.
//
// Body: { email: string }
// Retorna:
//   - { status: 'nao_existe' } — pode cadastrar
//   - { status: 'pendente' } — só falta pagar
//   - { status: 'ativa' } — manda pro login
//   - { status: 'suspensa' } — fala com suporte

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = (body?.email || '').toString().trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ status: 'nao_existe' })
    }

    const supabase = supabaseAdmin()
    const { data } = await supabase
      .from('revendedoras')
      .select('status')
      .ilike('email', email)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ status: 'nao_existe' })
    }

    const st = (data.status || 'pendente').toString().toLowerCase()
    if (st === 'ativa') return NextResponse.json({ status: 'ativa' })
    if (st === 'suspensa') return NextResponse.json({ status: 'suspensa' })
    return NextResponse.json({ status: 'pendente' })
  } catch {
    return NextResponse.json({ status: 'nao_existe' })
  }
}
