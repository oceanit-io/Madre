import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET /api/admin/list-recipients — lista os recipients da conta.
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  const resp = await fetch(`${BASE}/recipients?size=50`, {
    headers: { Authorization: auth, Accept: 'application/json' },
    cache: 'no-store',
  })
  const raw = await resp.text().catch(() => '')
  let parsed: { data?: Array<{ id?: string; name?: string; status?: string; document?: string; default?: boolean }> } = {}
  try { parsed = JSON.parse(raw) } catch { /* */ }

  return NextResponse.json({
    status_http: resp.status,
    total: parsed.data?.length || 0,
    recipients: parsed.data?.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      document_masked: r.document ? r.document.slice(0, 4) + '***' + r.document.slice(-2) : null,
      default: r.default,
    })) || [],
  })
}
