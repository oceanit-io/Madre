import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { pagarmeHabilitado } from '@/lib/pagarme'
import { emailsAoMudarStatus } from '@/lib/pedidoEmails'

export const dynamic = 'force-dynamic'

// Webhook Pagar.me. INERTE enquanto não houver PAGARME_SECRET_KEY: responde
// 200 e ignora. Quando ativo, ao receber `order.paid` marca o pedido como
// 'pago' (o trigger do banco gera a comissão + dispara os e-mails de pagamento).
//
// Mapeamento: criamos o link com order_code = numeroPedido, então o webhook
// traz isso em data.code (order.paid) — usamos pra achar o pedido.
//
// Segurança opcional: setar PAGARME_WEBHOOK_USER + PAGARME_WEBHOOK_PASS e
// configurar a mesma credencial (Basic auth) no painel Pagar.me.
export async function POST(request: Request) {
  if (!pagarmeHabilitado()) {
    return NextResponse.json({ ok: true, ignored: 'pagarme desativado' })
  }

  const user = process.env.PAGARME_WEBHOOK_USER
  const pass = process.env.PAGARME_WEBHOOK_PASS
  if (user && pass) {
    const auth = request.headers.get('authorization') || ''
    const esperado = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
    if (auth !== esperado) {
      return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
    }
  }

  let body: {
    type?: string
    data?: {
      id?: string
      code?: string
      status?: string
      order?: { code?: string }
    }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true, ignored: 'body inválido' })
  }

  const tipo = body.type || ''
  const data = body.data || {}
  const supabase = supabaseAdmin()

  // ---------- Eventos de RECEBEDOR (KYC) ----------
  // recipient.created/updated/registration_failed/etc. → atualiza status
  // do recebedor da revendedora no nosso DB.
  if (tipo.startsWith('recipient.')) {
    const recipientId = data.id
    const novoStatus = (data.status || '').toLowerCase()
    if (recipientId && novoStatus) {
      try {
        await supabase
          .from('revendedoras')
          .update({ pagarme_recipient_status: novoStatus })
          .eq('pagarme_recipient_id', recipientId)
      } catch (e) {
        console.error('[webhook pagarme] erro ao atualizar recipient:', e)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ---------- Eventos de PEDIDO/COBRANÇA ----------
  // order.paid → data.code = nosso order_code. charge.paid → tenta data.order.code.
  const numeroPedido = data.code || data.order?.code
  const pago = tipo === 'order.paid' || tipo === 'charge.paid' || data.status === 'paid'

  if (!numeroPedido || !pago) {
    return NextResponse.json({ ok: true, ignored: 'sem pagamento aprovado' })
  }

  try {
    // `.select()` devolve as linhas afetadas — vazio = já estava pago, não reenvia.
    const { data: atualizados } = await supabase
      .from('pedidos')
      .update({ status: 'pago', pagbank_pago: true })
      .eq('numero_pedido', numeroPedido)
      .neq('status', 'pago')
      .select('numero_pedido, cliente_nome, cliente_email, total, slug_revendedora')

    const pedido = atualizados?.[0]
    if (pedido) {
      await emailsAoMudarStatus(supabase, pedido, 'pago')
    }
  } catch (e) {
    console.error('[webhook pagarme] erro ao marcar pago:', e)
    // responde 200 mesmo assim p/ a Pagar.me não reenviar em loop
  }

  return NextResponse.json({ ok: true })
}
