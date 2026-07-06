import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  const { searchParams } = new URL(request.url)
  const buscaRaw = (searchParams.get('busca') || '').trim()
  const apenasDestaque = searchParams.get('destaque') === '1'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const perPage = Math.min(
    60,
    Math.max(1, parseInt(searchParams.get('per_page') || '24', 10) || 24)
  )

  let query = supabase
    .from('produtos')
    .select(
      'id, sku, nome, categoria, preco, fotos, estoque, destaque, ativo',
      { count: 'exact' }
    )
    .eq('ativo', true)
    .order('destaque', { ascending: false })
    .order('nome', { ascending: true })

  if (apenasDestaque) query = query.eq('destaque', true)

  const busca = buscaRaw.replace(/[,%()]/g, ' ').trim()
  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,sku.ilike.%${busca}%`)
  }

  const from = (page - 1) * perPage
  const { data, count, error } = await query.range(from, from + perPage - 1)

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar produtos', detalhes: error.message },
      { status: 500 }
    )
  }

  const total = count || 0
  return NextResponse.json({
    produtos: data || [],
    total,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
  })
}
