// GET  /api/admin/saques         — lista todos saques + dados da revendedora
// PATCH /api/admin/saques/[id]    — muda status (solicitado → processando → pago)

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const admin = supabaseAdmin()

  const url = new URL(request.url)
  const status = url.searchParams.get('status') // opcional: solicitado/processando/pago/recusado/todos

  let q = admin
    .from('saques')
    .select('id, revendedora_id, tipo, valor, chave_pix, status, criado_em, pago_em')
    .order('criado_em', { ascending: false })
    .limit(200)

  if (status && status !== 'todos') q = q.eq('status', status)

  const { data: saques } = await q

  const revIds = Array.from(new Set((saques || []).map(s => s.revendedora_id).filter(Boolean))) as string[]
  const revMap = new Map<string, { nome: string; subdominio: string; whatsapp: string | null }>()
  if (revIds.length > 0) {
    const { data: revs } = await admin
      .from('revendedoras')
      .select('id, nome, subdominio, whatsapp')
      .in('id', revIds)
    for (const r of revs || []) {
      revMap.set(r.id, {
        nome: r.nome,
        subdominio: r.subdominio,
        whatsapp: (r.whatsapp as string) || null,
      })
    }
  }

  return NextResponse.json({
    saques: (saques || []).map(s => ({
      id: s.id,
      revendedora_id: s.revendedora_id,
      revendedora_nome: revMap.get(s.revendedora_id)?.nome || '—',
      revendedora_subdominio: revMap.get(s.revendedora_id)?.subdominio || '',
      revendedora_whatsapp: revMap.get(s.revendedora_id)?.whatsapp || '',
      tipo: s.tipo,
      valor: Number(s.valor || 0),
      chave_pix: s.chave_pix,
      status: s.status,
      criado_em: s.criado_em,
      pago_em: s.pago_em,
    })),
  })
}
