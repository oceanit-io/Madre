import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Debug: consulta status de um pedido direto na API Pagar.me.
// Útil pra ver se o pagamento foi feito (e o webhook falhou) ou se
// nem chegou a tentar pagar.
//
// GET /api/admin/pedido-pagarme?numero=PED-XXXX
//   Authorization: Bearer prata925
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const numero = new URL(request.url).searchParams.get('numero') || ''
  if (!numero) {
    return NextResponse.json({ erro: 'use ?numero=PED-...' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: ped } = await admin
    .from('pedidos')
    .select('numero_pedido, status, total, cliente_email, pagbank_link, pagbank_pago, created_at')
    .eq('numero_pedido', numero)
    .single()

  if (!ped) {
    return NextResponse.json({ erro: 'pedido não encontrado no DB' }, { status: 404 })
  }

  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) {
    return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  }
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  // Buscar orders por code (= numero_pedido).
  let ordersResult: unknown = null
  try {
    const resp = await fetch(`${BASE}/orders?code=${encodeURIComponent(numero)}&size=20`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      cache: 'no-store',
    })
    const raw = await resp.text().catch(() => '')
    let parsed: unknown = null
    try { parsed = JSON.parse(raw) } catch { parsed = { raw_preview: raw.slice(0, 1000) } }
    ordersResult = {
      status_http: resp.status,
      ok: resp.ok,
      data: parsed,
    }
  } catch (e) {
    ordersResult = { erro_rede: e instanceof Error ? e.message : String(e) }
  }

  // Extrair paymentlink ID do link salvo.
  const linkMatch = /\/(pl_[a-zA-Z0-9]+)$/.exec(ped.pagbank_link || '')
  const paymentlinkId = linkMatch ? linkMatch[1] : null

  // Pra cada charge encontrada, buscar detalhe individual em /charges/{id}
  // pra ter last_transaction com gateway_response + acquirer_message.
  type OrderItem = { id?: string; status?: string; created_at?: string; charges?: Array<{ id?: string }> }
  type ChargeDetail = {
    id?: string
    status?: string
    amount?: number
    payment_method?: string
    last_transaction?: {
      success?: boolean
      status?: string
      gateway_response?: { code?: string; errors?: Array<{ message?: string }> }
      acquirer_message?: string
      acquirer_return_code?: string
      acquirer_name?: string
      installments?: number
      card?: { brand?: string; last_four_digits?: string }
    }
  }
  // ordersResult = { status_http, ok, data: pagarmeResponse }
  // pagarmeResponse = { data: [orders], paging: {} }
  const wrapper = ordersResult as { data?: { data?: OrderItem[] } } | null
  const ordersList: OrderItem[] = wrapper?.data?.data || []
  const chargeIds: string[] = []
  for (const o of ordersList) {
    for (const c of o.charges || []) {
      if (c.id) chargeIds.push(c.id)
    }
  }

  const chargesDetails: Record<string, unknown> = {}
  // Retorna o response RAW da Pagar.me pra primeira charge (debug),
  // mas extrai resumo dos demais.
  await Promise.all(chargeIds.slice(0, 10).map(async (id, idx) => {
    try {
      const resp = await fetch(`${BASE}/charges/${id}`, {
        headers: { Authorization: auth, Accept: 'application/json' },
        cache: 'no-store',
      })
      const raw = await resp.text().catch(() => '')
      let parsed: ChargeDetail & Record<string, unknown> = {} as ChargeDetail & Record<string, unknown>
      try { parsed = JSON.parse(raw) as ChargeDetail & Record<string, unknown> } catch { /* */ }
      const lt = parsed.last_transaction || {}

      // Todas as charges retornam resumo + antifraud + last_transaction
      // flatten, pra ver motivo das falhas em sequência.
      const ltRaw = parsed.last_transaction as Record<string, unknown> | undefined
      const af = (ltRaw?.antifraud_response || {}) as Record<string, unknown>
      chargesDetails[id] = {
        status: parsed.status,
        payment_method: parsed.payment_method,
        amount_cent: parsed.amount,
        created_at: ltRaw?.created_at,
        last_transaction_status: ltRaw?.status,
        last_transaction_success: ltRaw?.success,
        acquirer_name: lt.acquirer_name,
        acquirer_message: lt.acquirer_message,
        acquirer_return_code: lt.acquirer_return_code,
        gateway_response_code: lt.gateway_response?.code,
        gateway_response_errors: lt.gateway_response?.errors,
        installments: lt.installments,
        card_brand: lt.card?.brand,
        card_last4: lt.card?.last_four_digits,
        card_holder: (ltRaw?.card as Record<string, unknown> | undefined)?.holder_name,
        antifraud_status: af.status,
        antifraud_score: af.score,
        antifraud_provider: af.provider_name,
      }
    } catch (e) {
      chargesDetails[id] = { erro: e instanceof Error ? e.message : String(e) }
    }
  }))

  let paymentlinkResult: unknown = null
  if (paymentlinkId) {
    try {
      const resp = await fetch(`${BASE}/paymentlinks/${paymentlinkId}`, {
        headers: { Authorization: auth, Accept: 'application/json' },
        cache: 'no-store',
      })
      const raw = await resp.text().catch(() => '')
      let parsed: unknown = null
      try { parsed = JSON.parse(raw) } catch { parsed = { raw_preview: raw.slice(0, 1000) } }
      paymentlinkResult = {
        status_http: resp.status,
        ok: resp.ok,
        data: parsed,
      }
    } catch (e) {
      paymentlinkResult = { erro_rede: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({
    pedido_db: ped,
    paymentlink_id: paymentlinkId,
    pagarme: {
      orders_by_code: ordersResult,
      charges_detail: chargesDetails,
      paymentlink: paymentlinkResult,
    },
  })
}
