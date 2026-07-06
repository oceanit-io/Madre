import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { pagbankHabilitado } from '@/lib/pagbank'
import { emailsAoMudarStatus } from '@/lib/pedidoEmails'

export const dynamic = 'force-dynamic'

// Webhook PagBank. INERTE enquanto não houver PAGBANK_TOKEN configurado:
// responde 200 e ignora. Quando ativo, ao receber pagamento aprovado
// marca o pedido como 'pago' (o trigger do banco gera a comissão).
//
// Opcional: setar PAGBANK_WEBHOOK_TOKEN e registrar a URL no PagBank como
//   {APP_URL}/api/webhook/pagbank?token=SEU_TOKEN
export async function POST(request: Request) {
  if (!pagbankHabilitado()) {
    return NextResponse.json({ ok: true, ignored: 'pagbank desativado' })
  }

  // Verificação opcional por token compartilhado
  const esperado = process.env.PAGBANK_WEBHOOK_TOKEN
  if (esperado) {
    const url = new URL(request.url)
    const recebido =
      url.searchParams.get('token') ||
      request.headers.get('x-webhook-token') ||
      ''
    if (recebido !== esperado) {
      return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
    }
  }

  let body: {
    reference_id?: string
    charges?: { status?: string }[]
    status?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true, ignored: 'body inválido' })
  }

  const refId = body.reference_id
  const pago =
    body.status === 'PAID' ||
    (body.charges || []).some(c => c?.status === 'PAID')

  if (!refId || !pago) {
    // não é um evento de pagamento aprovado — ignora sem erro
    return NextResponse.json({ ok: true, ignored: 'sem pagamento aprovado' })
  }

  // Cadastro de revendedora: reference_id começa com "cad_<uuid>".
  // Ativa a conta automaticamente quando paga.
  if (refId.startsWith('cad_')) {
    try {
      const revendedora_id = refId.slice(4)
      const supabase = supabaseAdmin()
      const { data: ativada } = await supabase
        .from('revendedoras')
        .update({ status: 'ativa' })
        .eq('id', revendedora_id)
        .neq('status', 'ativa')
        .select('id, nome, email')
      if (ativada?.[0]) {
        console.log(`[webhook pagbank] revendedora ativada: ${ativada[0].nome} (${ativada[0].email})`)
        // TODO: email "conta ativa, bora vender" — best-effort, não bloqueia
      }
    } catch (e) {
      console.error('[webhook pagbank] erro ao ativar revendedora:', e)
    }
    return NextResponse.json({ ok: true })
  }

  // Pedido normal de cliente: marca pago + dispara emails.
  try {
    const supabase = supabaseAdmin()
    const { data: atualizados } = await supabase
      .from('pedidos')
      .update({ status: 'pago', pagbank_pago: true })
      .eq('numero_pedido', refId)
      .neq('status', 'pago')
      .select('numero_pedido, cliente_nome, cliente_email, total, slug_revendedora')

    const pedido = atualizados?.[0]
    if (pedido) {
      // E-mails de pagamento (cliente + revendedora) — best-effort.
      await emailsAoMudarStatus(supabase, pedido, 'pago')
    }
  } catch (e) {
    console.error('[webhook pagbank] erro ao marcar pago:', e)
    // responde 200 mesmo assim p/ o PagBank não ficar reenviando em loop
  }

  return NextResponse.json({ ok: true })
}
