// GET /api/admin/pagarme-hooks — lista webhooks configurados na conta
// Pagar.me. Útil pra confirmar que existe pelo menos um apontando pro
// nosso /api/webhook/pagarme com eventos order.paid / charge.paid.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  // /v5/hooks devolve ENTREGAS de webhook (cada vez que Pagar.me POSTou
  // pra nós) — não a configuração dos endpoints. Cada item tem id, url,
  // status (sent/failed/etc.) e um campo `event` ou `type` com o nome
  // do evento. Pra confirmar setup, basta confirmar que existem
  // entregas pra nosso host nos eventos críticos.
  const resp = await fetch(`${BASE}/hooks?size=50`, {
    headers: { Authorization: auth, Accept: 'application/json' },
    cache: 'no-store',
  })
  const raw = await resp.text().catch(() => '')
  type Hook = {
    id?: string
    url?: string
    status?: string
    event?: string
    type?: string
    response_status?: number
    created_at?: string
    response?: { status?: number }
  }
  let parsed: { data?: Hook[] } = {}
  try { parsed = JSON.parse(raw) } catch { /* */ }

  const hooks = parsed.data || []
  const onossoHost = 'lojadeprata925.com.br'
  const apontamPraNos = hooks.filter(h => (h.url || '').includes(onossoHost))

  // Mapeia hooks pra (event, status) — útil pra ver o que chegou.
  const porEvento = new Map<string, { ok: number; falhou: number }>()
  for (const h of apontamPraNos) {
    const ev = h.event || h.type || '(?)'
    const ok = h.status === 'sent' || h.status === 'success' || (h.response?.status && h.response.status < 400)
    const m = porEvento.get(ev) || { ok: 0, falhou: 0 }
    if (ok) m.ok++; else m.falhou++
    porEvento.set(ev, m)
  }
  const eventos = Object.fromEntries(porEvento)

  const eventosCriticos = ['order.paid', 'charge.paid']
  const recebeuPagamento = eventosCriticos.some(e => porEvento.has(e) && (porEvento.get(e)?.ok || 0) > 0)
  const algumFalhou = apontamPraNos.some(h => h.status === 'failed' || (h.response?.status && h.response.status >= 400))

  return NextResponse.json({
    status_http: resp.status,
    total_entregas_recentes: hooks.length,
    apontam_pra_nos: apontamPraNos.length,
    eventos_por_tipo: eventos,
    ja_recebeu_pagamento: recebeuPagamento,
    alguma_entrega_falhou: algumFalhou,
    veredito: apontamPraNos.length === 0
      ? '🔴 NENHUMA entrega pra lojadeprata925.com.br nos últimos eventos. Verificar dash.pagar.me → Configurações → Webhooks.'
      : recebeuPagamento
        ? '✅ Webhook funciona — Pagar.me já entregou order.paid/charge.paid com sucesso.'
        : `✅ Webhook plumbing ok (${apontamPraNos.length} entregas chegaram). Eventos de pagamento ainda não apareceram porque ninguém pagou ainda — vai aparecer no 1º teste real.`,
    primeiras_entregas: apontamPraNos.slice(0, 5).map(h => ({
      id: h.id,
      url: h.url,
      event: h.event || h.type,
      status: h.status,
      response_status: h.response?.status,
      created_at: h.created_at,
    })),
  })
}
