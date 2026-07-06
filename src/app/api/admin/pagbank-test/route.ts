// GET /api/admin/pagbank-test
//
// Testa a API PagBank com um pedido fake e retorna a resposta CRUA
// (status + headers + body do erro) pra debugar problemas de
// autenticação, payload inválido, conta sem privilégios, etc.
//
// NÃO cria pedido real — usa um reference_id de teste óbvio.
// Protegido por checkAdminAuth.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const token = process.env.PAGBANK_TOKEN
  if (!token) {
    return NextResponse.json({ erro: 'PAGBANK_TOKEN não configurado' }, { status: 500 })
  }

  const BASE = process.env.PAGBANK_BASE_URL || 'https://api.pagseguro.com'
  const appUrl = process.env.APP_URL || 'https://lojadeprata925.com.br'

  const payload = {
    reference_id: `teste_diag_${Date.now()}`,
    customer: {
      name: 'Teste Diagnostico',
      email: 'teste@diag.com',
    },
    items: [{
      reference_id: 'teste_item',
      name: 'Teste API PagBank',
      quantity: 1,
      unit_amount: 100, // R$ 1,00 só pra testar
    }],
    notification_urls: [`${appUrl}/api/webhook/pagbank`],
    redirect_url: `${appUrl}/auth/login?paid=1`,
  }

  try {
    const res = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      base_url: BASE,
      token_prefix: token.slice(0, 20) + '...' + token.slice(-8),
      payload_enviado: payload,
      resposta_pagbank: body,
    })
  } catch (e) {
    return NextResponse.json({
      erro: 'erro de rede',
      detalhe: e instanceof Error ? e.message : String(e),
      base_url: BASE,
    }, { status: 500 })
  }
}
