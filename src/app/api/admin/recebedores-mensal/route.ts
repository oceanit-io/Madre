// GET /api/admin/recebedores-mensal — atualiza o transfer_settings de TODOS
// os recebedores das REVENDEDORAS pra MENSAL (dia 5), em vez de diário. Assim
// a parte da revendedora no split não cai na hora (retém ~até o dia do mês).
//
// Só mexe nos recebedores das revendedoras (revendedoras.pagarme_recipient_id)
// — NÃO toca na conta mãe nem na Prata 15 (que recebem direto). Admin-only,
// não-viewer. Idempotente (pode rodar de novo). Usa a key do servidor.

import { NextResponse } from 'next/server'
import { checkAdminAuth, isReadOnlyAdmin } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
const BASE = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (isReadOnlyAdmin(request)) {
    return NextResponse.json({ erro: 'Viewer não pode alterar' }, { status: 403 })
  }
  const key = process.env.PAGARME_SECRET_KEY || ''
  if (!key) return NextResponse.json({ erro: 'PAGARME_SECRET_KEY ausente' }, { status: 503 })
  const auth = 'Basic ' + Buffer.from(`${key}:`).toString('base64')

  const supabase = supabaseAdmin()
  const { data: revs } = await supabase
    .from('revendedoras')
    .select('subdominio, nome, pagarme_recipient_id')
    .not('pagarme_recipient_id', 'is', null)

  const settings = { transfer_enabled: true, transfer_interval: 'monthly', transfer_day: 5 }
  const resultados: Array<Record<string, unknown>> = []

  for (const r of revs || []) {
    const rid = String(r.pagarme_recipient_id || '')
    if (!rid) continue
    try {
      const resp = await fetch(`${BASE}/recipients/${rid}/transfer-settings`, {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const txt = await resp.text().catch(() => '')
      resultados.push({
        revendedora: r.subdominio,
        recipient: rid,
        ok: resp.ok,
        status: resp.status,
        detalhe: resp.ok ? 'monthly/dia 5' : txt.slice(0, 250),
      })
    } catch (e) {
      resultados.push({ revendedora: r.subdominio, recipient: rid, ok: false, erro: String(e) })
    }
  }

  const okCount = resultados.filter(x => x.ok).length
  return NextResponse.json({
    total: resultados.length,
    atualizados: okCount,
    falharam: resultados.length - okCount,
    config: settings,
    resultados,
  })
}
