import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET /api/admin/inspect-order?id=or_xxx — retorna order RAW completa.
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ erro: 'use ?id=or_xxx' }, { status: 400 })

  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  const resp = await fetch(`${BASE}/orders/${id}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
    cache: 'no-store',
  })
  const raw = await resp.text().catch(() => '')
  let parsed: unknown = null
  try { parsed = JSON.parse(raw) } catch { parsed = { raw_preview: raw.slice(0, 2000) } }
  return NextResponse.json({ status_http: resp.status, ok: resp.ok, data: parsed })
}
