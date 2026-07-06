// POST /api/auth/criar-pagamento-cadastro
//
// Gera link de pagamento InfinitePay pra ativação da loja (R$ 39,90).
// Cada link é único por revendedora — order_nsu = `cad_${id}`.
// Quando paga:
//   1. InfinitePay manda POST pro /api/webhook/infinitepay → ativa conta
//   2. Redireciona o browser pra /auth/login?paid=1
//
// Body: { email: string }
//
// Retorna:
//   { link: string }                    — sucesso, abre esse URL
//   { erro: string, fallback: true }    — falha, usar link estático

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { criarLinkCadastroInfinitePay } from '@/lib/infinitepay'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = (body?.email || '').toString().trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ erro: 'Email obrigatório' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: rev } = await supabase
    .from('revendedoras')
    .select('id, nome, email, whatsapp, status')
    .ilike('email', email)
    .maybeSingle()

  if (!rev) {
    return NextResponse.json({ erro: 'Revendedora não encontrada' }, { status: 404 })
  }
  // Permitimos gerar link mesmo se ativa, porque ativas também precisam
  // pagar mensalidade (R$ 39,90 mensais). Webhook trata ativação como
  // no-op pra quem já tá ativa, mas o pagamento é recebido na conta.

  const r = await criarLinkCadastroInfinitePay({
    revendedora_id: rev.id,
    nome: rev.nome || 'Revendedora',
    email: rev.email,
    whatsapp: rev.whatsapp || '',
  })

  if (!r) {
    return NextResponse.json({ erro: 'Falha ao criar link de pagamento', fallback: true }, { status: 502 })
  }

  return NextResponse.json({ link: r.url })
}
