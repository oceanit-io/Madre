// GET /api/admin/audit-log → últimas 200 ações.
// Filtros via query: ?quem=gabby&acao=editar_pedido&limit=200

import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const quem = url.searchParams.get('quem')
  const acao = url.searchParams.get('acao')
  const limitRaw = parseInt(url.searchParams.get('limit') || '200', 10)
  const limit = Math.min(Math.max(limitRaw, 1), 500)

  let q = supabaseAdmin()
    .from('admin_audit_log')
    .select('id, quem, acao, alvo, detalhes, ip, criado_em')
    .order('criado_em', { ascending: false })
    .limit(limit)

  if (quem) q = q.eq('quem', quem)
  if (acao) q = q.eq('acao', acao)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] })
}
