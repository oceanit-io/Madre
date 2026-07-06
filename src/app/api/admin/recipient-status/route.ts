import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Compara o status do recipient no nosso DB vs status REAL no Pagar.me.
// GET /api/admin/recipient-status?slug=gabrielafernandez-5034
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const slug = new URL(request.url).searchParams.get('slug') || ''
  if (!slug) return NextResponse.json({ erro: 'use ?slug=...' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: rev } = await admin
    .from('revendedoras')
    .select('nome, pagarme_recipient_id, pagarme_recipient_status, atualizado_em')
    .eq('subdominio', slug)
    .single()

  if (!rev?.pagarme_recipient_id) {
    return NextResponse.json({ erro: 'rev não tem pagarme_recipient_id' })
  }

  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')
  const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

  let pagarme: unknown = null
  try {
    const resp = await fetch(`${BASE}/recipients/${rev.pagarme_recipient_id}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      cache: 'no-store',
    })
    const raw = await resp.text().catch(() => '')
    let parsed: { id?: string; status?: string; payment_mode?: string; transfer_enabled?: boolean } = {}
    try { parsed = JSON.parse(raw) } catch { /* */ }
    pagarme = {
      status_http: resp.status,
      ok: resp.ok,
      id: parsed.id,
      status_real: parsed.status,
      transfer_enabled: parsed.transfer_enabled,
      payment_mode: parsed.payment_mode,
      raw_preview: raw.slice(0, 500),
    }
  } catch (e) {
    pagarme = { erro_rede: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    db: {
      nome: rev.nome,
      pagarme_recipient_id: rev.pagarme_recipient_id,
      pagarme_recipient_status: rev.pagarme_recipient_status,
      atualizado_em: rev.atualizado_em,
    },
    pagarme,
  })
}
