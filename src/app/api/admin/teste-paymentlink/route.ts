import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// Cria um paymentlink REAL no Pagar.me com split, sem mexer no DB. Retorna
// o paymentlink criado (URL + ID) pra inspecionar no painel Pagar.me e
// confirmar que as regras de split foram salvas.
//
// GET /api/admin/teste-paymentlink?recipientId=re_xxx
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const recipientId = new URL(request.url).searchParams.get('recipientId') || ''
  if (!recipientId) {
    return NextResponse.json({ erro: 'use ?recipientId=re_xxx' }, { status: 400 })
  }

  const numeroFake = `TEST-${Date.now()}`
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  const body = {
    type: 'order',
    name: `Teste split debug - ${numeroFake}`,
    order_code: numeroFake,
    payment_settings: {
      accepted_payment_methods: ['credit_card', 'pix'],
      credit_card_settings: {
        operation_type: 'auth_and_capture',
        installments: [{ number: 1, total: 4105 }],
      },
      pix_settings: { expires_in: 3600 },
    },
    cart_settings: { items: [{ name: 'Teste', amount: 4105, default_quantity: 1 }] },
    customer_settings: { customer: { name: 'Teste Debug', email: 'debug@example.com' } },
    // 4105 = rev(897) + prata15(3193) + main(15)
    split_settings: {
      rules: [
        {
          recipient_id: recipientId, // rev
          amount: 897,
          type: 'flat',
          options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
        },
        {
          recipient_id: 're_cmq6titmznhjf0l9taflgyit2', // Prata 15
          amount: 3193,
          type: 'flat',
          options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
        },
        {
          recipient_id: 're_cmpy6nnehaw8g0l9tipdwk6lg', // conta mãe Gabriela
          amount: 15,
          type: 'flat',
          options: { charge_processing_fee: true, charge_remainder_fee: true, liable: true },
        },
      ],
    },
  }

  try {
    const resp = await fetch(`${BASE}/paymentlinks`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const raw = await resp.text().catch(() => '')
    let parsed: unknown = null
    try { parsed = JSON.parse(raw) } catch { parsed = { raw_preview: raw.slice(0, 2000) } }
    return NextResponse.json({
      status_http: resp.status,
      ok: resp.ok,
      response: parsed,
      payload_enviado: body,
      numero_fake: numeroFake,
    })
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
