// GET /api/admin/saldo-pagarme — saldo REAL de cada recipient na conta
// Pagar.me. Independente do nosso DB Supabase.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

const RECIPIENTS = [
  { id: 're_cmpy6nnehaw8g0l9tipdwk6lg', label: 'Conta mãe (CNPJ 52)' },
  { id: 're_cmq6titmznhjf0l9taflgyit2', label: 'Prata 15' },
  { id: 're_cmq6qghrfgz540l9tmrye6wt0', label: 'Rev Gabriela' },
  { id: 're_cmq6q0tgae06v0l9t5ei38jsr', label: 'Gabriela duplicada (extra)' },
]

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  const results = await Promise.all(
    RECIPIENTS.map(async r => {
      try {
        const resp = await fetch(`${BASE}/recipients/${r.id}/balance`, {
          headers: { Authorization: auth, Accept: 'application/json' },
          cache: 'no-store',
        })
        const data = await resp.json().catch(() => ({}))
        return {
          id: r.id,
          label: r.label,
          status_http: resp.status,
          available: typeof data.available_amount === 'number' ? data.available_amount / 100 : null,
          waiting_funds: typeof data.waiting_funds_amount === 'number' ? data.waiting_funds_amount / 100 : null,
          transferred: typeof data.transferred_amount === 'number' ? data.transferred_amount / 100 : null,
          currency: data.currency || 'BRL',
        }
      } catch (e) {
        return { id: r.id, label: r.label, erro: e instanceof Error ? e.message : String(e) }
      }
    })
  )

  return NextResponse.json({
    recipients: results,
    soma_available: results.reduce((s, r) => s + Number(r.available || 0), 0),
    soma_waiting: results.reduce((s, r) => s + Number(r.waiting_funds || 0), 0),
  })
}
