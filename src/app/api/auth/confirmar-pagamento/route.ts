// POST /api/auth/confirmar-pagamento
//
// Quando uma revendedora pendente volta de pagar no InfinitePay,
// chamamos este endpoint pra verificar via API deles se o pagamento
// realmente aconteceu (anti-fraude — não confiamos só no redirect)
// e ativar a conta dela automaticamente.
//
// Body: {
//   email: string,        // identificador da revendedora
//   slug?: string,        // invoice_slug do redirect
//   transaction_nsu?: string,
//   order_nsu?: string,
// }
//
// Retorna:
//   { ok: true, ativada: boolean }
//   { ok: false, erro: string }

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verificarPagamentoInfinitePay } from '@/lib/infinitepay'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = (body?.email || '').toString().trim().toLowerCase()
  const slug = (body?.slug || '').toString().trim()
  const transaction_nsu = (body?.transaction_nsu || '').toString().trim()
  const order_nsu = (body?.order_nsu || '').toString().trim()

  if (!email) {
    return NextResponse.json({ ok: false, erro: 'Email obrigatório' }, { status: 400 })
  }
  if (!slug || !transaction_nsu) {
    return NextResponse.json({ ok: false, erro: 'Parâmetros do pagamento ausentes' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: rev } = await supabase
    .from('revendedoras')
    .select('id, nome, email, status')
    .ilike('email', email)
    .maybeSingle()

  if (!rev) {
    return NextResponse.json({ ok: false, erro: 'Revendedora não encontrada' }, { status: 404 })
  }
  if (rev.status === 'ativa') {
    return NextResponse.json({ ok: true, ativada: true, ja_ativa: true })
  }

  // Verifica pagamento via InfinitePay API (anti-fraude)
  const r = await verificarPagamentoInfinitePay({
    order_nsu: order_nsu || 'unknown',
    transaction_nsu,
    invoice_slug: slug,
  })

  if (!r) {
    return NextResponse.json({
      ok: false,
      erro: 'Não consegui confirmar o pagamento no InfinitePay agora. Aguarde alguns minutos ou contate o suporte.',
    }, { status: 502 })
  }

  if (!r.paid) {
    return NextResponse.json({
      ok: false,
      erro: 'Pagamento ainda não foi confirmado pelo InfinitePay. Pode levar alguns minutos.',
      pago: false,
    }, { status: 402 })
  }

  // Pagamento confirmado → ativa a revendedora
  const { error: updErr } = await supabase
    .from('revendedoras')
    .update({ status: 'ativa' })
    .eq('id', rev.id)
    .neq('status', 'ativa')

  if (updErr) {
    return NextResponse.json({
      ok: false,
      erro: 'Pagamento confirmado mas falhou ao ativar. Contate o suporte.',
    }, { status: 500 })
  }

  console.log(`[confirmar-pagamento] ativada: ${rev.nome} (${rev.email}) via redirect InfinitePay`)

  return NextResponse.json({
    ok: true,
    ativada: true,
    nome: rev.nome,
  })
}
