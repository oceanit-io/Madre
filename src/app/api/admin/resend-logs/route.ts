// GET /api/admin/resend-logs
//
// Lista os últimos 100 emails enviados via Resend. Útil pra investigar
// se notificações automáticas (pendente-logou, pagamento-sem-match)
// foram realmente disparadas e entregues.

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erro: 'RESEND_API_KEY ausente no env' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      total: data?.data?.length || 0,
      emails: data?.data || data,
    })
  } catch (e) {
    return NextResponse.json({
      erro: 'erro de rede',
      detalhe: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}
