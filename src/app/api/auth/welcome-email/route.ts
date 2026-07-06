// POST /api/auth/welcome-email
// Body: { email, nome }
// Dispara email de "cadastro recebido" com link InfinitePay dinâmico
// pra pagamento. Best-effort: se Resend ou InfinitePay falhar, não
// trava o cadastro.

import { NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/email'
import { cadastroRecebidoEmail } from '@/lib/emailTemplates'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { criarLinkCadastroInfinitePay } from '@/lib/infinitepay'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { email?: string; nome?: string } = {}
  try { body = await request.json() } catch { /* */ }

  const email = (body.email || '').trim().toLowerCase()
  const nome = (body.nome || '').trim()
  if (!email || !nome) {
    return NextResponse.json({ ok: false, erro: 'email e nome obrigatórios' }, { status: 400 })
  }

  // Busca a revendedora pra ter o ID (pro order_nsu único)
  let linkPagamento = ''
  try {
    const supabase = supabaseAdmin()
    const { data: rev } = await supabase
      .from('revendedoras')
      .select('id, nome, email, whatsapp')
      .ilike('email', email)
      .maybeSingle()
    if (rev) {
      const r = await criarLinkCadastroInfinitePay({
        revendedora_id: rev.id,
        nome: rev.nome || nome,
        email: rev.email,
        whatsapp: rev.whatsapp || '',
      })
      if (r) linkPagamento = r.url
    }
  } catch (e) {
    console.error('[welcome-email] falha ao gerar link InfinitePay:', e)
  }

  if (!linkPagamento) {
    // Sem link → não manda email com botão quebrado. Loga e segue.
    console.error('[welcome-email] sem link, não mandou email pra', email)
    return NextResponse.json({ ok: false, erro: 'link indisponível' }, { status: 200 })
  }

  try {
    const { subject, html } = cadastroRecebidoEmail({ nome, linkPagamento })
    const r = await enviarEmail({ to: email, subject, html })
    return NextResponse.json({ ok: r.ok })
  } catch (e) {
    console.error('[welcome-email] falhou:', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
