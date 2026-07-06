// Webhook InfinitePay — formato real conforme docs + fallbacks.
//
// 3 estratégias de ativação automática, em ordem:
//   1. order_nsu = 'cad_<uuid>' (link dinâmico via API)
//   2. Match por email/CPF/telefone do customer no payload
//   3. Notifica Gabriela por email pra ela ativar manual
//
// SEMPRE retorna 200 OK (≤1s, conforme InfinitePay) pra evitar reenvio.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { emailsAoMudarStatus } from '@/lib/pedidoEmails'
import { notificarPagamentoSemMatch } from '@/lib/notifyAdmin'
import { enviarEmail } from '@/lib/email'
import { lojaAtivadaEmail } from '@/lib/emailTemplates'

export const dynamic = 'force-dynamic'

type PayloadInfinitePay = {
  invoice_slug?: string
  amount?: number
  paid_amount?: number
  installments?: number
  capture_method?: 'credit_card' | 'pix' | string
  transaction_nsu?: string
  order_nsu?: string
  receipt_url?: string
  items?: unknown[]
  // Campos extras possíveis (não documentados oficialmente mas
  // que podem vir em payloads reais):
  customer?: {
    name?: string
    email?: string
    tax_id?: string
    phone?: string
    phone_number?: string
  }
  payer?: {
    name?: string
    email?: string
    document?: string
  }
  email?: string
  [key: string]: unknown
}

function soDigitos(s?: string): string {
  return (s || '').replace(/\D/g, '')
}

export async function POST(request: Request) {
  // Auth opcional via token compartilhado
  const esperado = process.env.INFINITEPAY_WEBHOOK_TOKEN
  if (esperado) {
    const url = new URL(request.url)
    const recebido =
      url.searchParams.get('token') ||
      request.headers.get('x-webhook-token') ||
      ''
    if (recebido !== esperado) {
      console.warn('[webhook infinitepay] token inválido')
      return NextResponse.json({ ok: true })
    }
  }

  let body: PayloadInfinitePay
  let raw = ''
  try {
    raw = await request.text()
    body = JSON.parse(raw) as PayloadInfinitePay
  } catch {
    console.error('[webhook infinitepay] body inválido:', raw.slice(0, 500))
    return NextResponse.json({ ok: true })
  }

  // Log MÍNIMO sem PII — antes volcava o payload e headers completos (com
  // CPF/email do cliente) nos logs da Vercel. Só o essencial pra rastrear.
  console.log('[webhook infinitepay] recebido', {
    order_nsu: body.order_nsu || null,
    paid_amount: body.paid_amount ?? null,
    capture_method: body.capture_method || null,
  })

  // Sanidade: paid_amount > 0 senão ignora
  if (!body.paid_amount || body.paid_amount <= 0) {
    return NextResponse.json({ ok: true, ignored: 'sem paid_amount' })
  }

  const supabase = supabaseAdmin()
  const orderNsu = body.order_nsu || ''

  // ESTRATÉGIA 1: order_nsu 'cad_<uuid>' (link dinâmico) — ativa OU renova.
  // Usa a RPC registrar_pagamento_mensalidade (idempotente por transaction_nsu
  // e que estende o vencimento), manda boas-vindas na 1ª ativação e notifica.
  if (orderNsu.startsWith('cad_')) {
    try {
      const revendedora_id = orderNsu.slice(4)
      const { data: rev } = await supabase
        .from('revendedoras')
        .select('id, nome, email, nome_loja, subdominio, status')
        .eq('id', revendedora_id)
        .maybeSingle()

      if (rev) {
        const novaAtivacao = rev.status !== 'ativa'
        const { data: res, error } = await supabase.rpc('registrar_pagamento_mensalidade', {
          p_rev_id: rev.id,
          p_valor: (body.paid_amount || 0) / 100, // centavos -> reais
          p_metodo: 'infinitepay',
          p_provider_tx: body.transaction_nsu || null,
        })

        if (error) {
          // Falha na RPC: loga e deixa cair nos fallbacks (email/telefone).
          console.error('[webhook] erro RPC mensalidade:', error.message)
        } else {
          const row = Array.isArray(res) ? res[0] : res
          const aplicado = row?.aplicado !== false // dedup retorna false

          if (aplicado) {
            // Notificação in-app (best-effort).
            try {
              await supabase.from('notificacoes').insert({
                revendedora_id: rev.id,
                titulo: novaAtivacao ? '🎉 Sua loja foi ativada!' : '✅ Mensalidade renovada',
                mensagem: novaAtivacao
                  ? 'Pagamento confirmado! Sua loja já está no ar. Bora vender! 💎'
                  : 'Recebemos seu pagamento. Sua loja segue ativa, sem interrupção. 🚀',
                tipo: 'sucesso',
              })
            } catch (e) { console.error('[webhook] notif falhou:', e) }

            // E-mail de boas-vindas só na ATIVAÇÃO (não a cada renovação).
            if (novaAtivacao && rev.email && rev.subdominio) {
              try {
                const { subject, html } = lojaAtivadaEmail({
                  nome: rev.nome || 'Revendedora',
                  nomeLoja: rev.nome_loja,
                  subdominio: rev.subdominio,
                })
                await enviarEmail({ to: rev.email, subject, html })
              } catch (e) { console.error('[webhook] email boas-vindas falhou:', e) }
            }
          }

          console.log(`[webhook] ✅ ${novaAtivacao ? 'ativada' : 'renovada'} via order_nsu: ${rev.nome} (aplicado=${aplicado})`)
          return NextResponse.json({ ok: true, ativada: true, via: 'order_nsu', aplicado })
        }
      }
    } catch (e) {
      console.error('[webhook] erro estratégia order_nsu:', e)
    }
  }

  // ESTRATÉGIA 2: match por email/CPF/telefone do customer
  // Tenta extrair customer info de várias localizações possíveis
  const customerEmail = (
    body.customer?.email ||
    body.payer?.email ||
    body.email ||
    ''
  ).toString().trim().toLowerCase()

  const customerCpf = soDigitos(
    body.customer?.tax_id ||
    body.payer?.document ||
    ''
  )

  const customerPhone = soDigitos(
    body.customer?.phone ||
    body.customer?.phone_number ||
    ''
  )

  const customerNome = (
    body.customer?.name ||
    body.payer?.name ||
    ''
  ).toString().trim()

  // Tenta achar pendente por email primeiro (mais confiável)
  if (customerEmail) {
    try {
      const { data: rev } = await supabase
        .from('revendedoras')
        .select('id, nome, email, status')
        .ilike('email', customerEmail)
        .eq('status', 'pendente')
        .maybeSingle()
      if (rev) {
        await supabase
          .from('revendedoras')
          .update({ status: 'ativa' })
          .eq('id', rev.id)
        console.log(`[webhook] ✅ ativada via email match: ${rev.nome} (${rev.email})`)
        return NextResponse.json({ ok: true, ativada: true, via: 'email_match' })
      }
    } catch (e) {
      console.error('[webhook] erro match email:', e)
    }
  }

  // Telefone como fallback
  if (customerPhone && customerPhone.length >= 10) {
    try {
      // Tenta com últimos 10-11 dígitos (DDD+número)
      const tail = customerPhone.slice(-11)
      const { data: rev } = await supabase
        .from('revendedoras')
        .select('id, nome, email, whatsapp, status')
        .eq('status', 'pendente')
      const match = (rev || []).find(r => soDigitos(r.whatsapp).endsWith(tail.slice(-10)))
      if (match) {
        await supabase
          .from('revendedoras')
          .update({ status: 'ativa' })
          .eq('id', match.id)
        console.log(`[webhook] ✅ ativada via phone match: ${match.nome}`)
        return NextResponse.json({ ok: true, ativada: true, via: 'phone_match' })
      }
    } catch (e) {
      console.error('[webhook] erro match phone:', e)
    }
  }

  // ESTRATÉGIA 3: pedido normal de cliente (loja)
  // order_nsu pode ser o numero_pedido nesse caso
  if (orderNsu && !orderNsu.startsWith('cad_')) {
    try {
      const { data: atualizados } = await supabase
        .from('pedidos')
        .update({ status: 'pago' })
        .eq('numero_pedido', orderNsu)
        .neq('status', 'pago')
        .select('numero_pedido, cliente_nome, cliente_email, total, slug_revendedora')
      const pedido = atualizados?.[0]
      if (pedido) {
        await emailsAoMudarStatus(supabase, pedido, 'pago')
        console.log(`[webhook] ✅ pedido marcado pago: ${orderNsu}`)
        return NextResponse.json({ ok: true, via: 'pedido' })
      }
    } catch (e) {
      console.error('[webhook] erro pedido:', e)
    }
  }

  // ESTRATÉGIA 4 (fallback): nada bateu — notifica Gabriela
  // Pagamento chegou mas não conseguimos identificar quem.
  // Manda email com tudo o que sabemos pra ela ativar manual.
  await notificarPagamentoSemMatch({
    amount: body.amount || 0,
    paid_amount: body.paid_amount,
    capture_method: body.capture_method,
    transaction_nsu: body.transaction_nsu,
    order_nsu: orderNsu,
    receipt_url: body.receipt_url,
    customer_email: customerEmail,
    customer_name: customerNome,
    raw_payload: body,
  })

  console.log('[webhook] ⚠️ sem match — Gabriela notificada por email')
  return NextResponse.json({ ok: true, via: 'admin_notify' })
}

// Ping de verificação
export async function GET() {
  return NextResponse.json({ ok: true, service: 'webhook-infinitepay' })
}
