// GET  /api/admin/alertas?lida=false       → lista alertas (default não lidas)
// POST /api/admin/alertas { id, lida } → marca como lida/não lida
// GET  /api/admin/alertas?count=1           → só conta não lidas

import { NextResponse } from 'next/server'
import { checkAdminAuth, getAdminUser } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAdminAction } from '@/lib/adminAudit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const onlyCount = url.searchParams.get('count') === '1'
  const filtroLida = url.searchParams.get('lida')
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200)

  const admin = supabaseAdmin()

  if (onlyCount) {
    const { count } = await admin
      .from('admin_alertas')
      .select('*', { count: 'exact', head: true })
      .eq('lida', false)
    return NextResponse.json({ nao_lidas: count || 0 })
  }

  let q = admin
    .from('admin_alertas')
    .select('id, tipo, titulo, mensagem, detalhes, link, lida, lida_em, lida_por, criado_em')
    .order('criado_em', { ascending: false })
    .limit(limit)
  if (filtroLida === 'false') q = q.eq('lida', false)
  if (filtroLida === 'true') q = q.eq('lida', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({})) as { id?: string; lida?: boolean; tudo?: boolean }
  const admin = supabaseAdmin()
  const quem = getAdminUser(request)

  if (body.tudo === true) {
    await admin
      .from('admin_alertas')
      .update({ lida: true, lida_em: new Date().toISOString(), lida_por: quem })
      .eq('lida', false)
    await logAdminAction({ request, acao: 'alerta_marcar_todas_lidas' })
    return NextResponse.json({ ok: true })
  }

  if (!body.id) return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 })

  const lida = body.lida !== false
  const { error } = await admin
    .from('admin_alertas')
    .update({
      lida,
      lida_em: lida ? new Date().toISOString() : null,
      lida_por: lida ? quem : null,
    })
    .eq('id', body.id)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  await logAdminAction({ request, acao: lida ? 'alerta_marcar_lida' : 'alerta_marcar_nao_lida', alvo: body.id })
  return NextResponse.json({ ok: true })
}
