import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { features } from '@/lib/features'

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
      'id, sku, nome, categoria, preco, preco_promo, fotos, estoque, destaque, lancamento, ativo',
      { count: 'exact' }
    )
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

export async function POST(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!features.ecommerce) {
    return NextResponse.json({ erro: 'feature_indisponivel' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const nome = (body.nome as string || '').trim()
  const sku = (body.sku as string || '').trim()
  const preco = Number(body.preco)

  if (!nome) return NextResponse.json({ erro: 'Nome obrigatório' }, { status: 400 })
  if (!sku)  return NextResponse.json({ erro: 'SKU obrigatório' }, { status: 400 })
  if (!preco || preco <= 0) return NextResponse.json({ erro: 'Preço inválido' }, { status: 400 })

  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('produtos')
    .insert({
      sku,
      nome,
      descricao: (body.descricao as string || '').trim() || null,
      categoria: (body.categoria as string || '').trim() || null,
      preco,
      preco_promo: body.preco_promo ? Number(body.preco_promo) : null,
      peso_g: body.peso_g ? Number(body.peso_g) : null,
      estoque: Number(body.estoque) || 0,
      fotos: Array.isArray(body.fotos) ? body.fotos.filter(Boolean) : [],
      marca: (body.marca as string || '').trim() || null,
      destaque: body.destaque === true,
      lancamento: body.lancamento === true,
      ativo: body.ativo !== false,
      altura_cm: body.altura_cm ? Number(body.altura_cm) : null,
      largura_cm: body.largura_cm ? Number(body.largura_cm) : null,
      comprimento_cm: body.comprimento_cm ? Number(body.comprimento_cm) : null,
      atualizado_em: new Date().toISOString(),
    })
    .select('id, sku, nome')
    .single()

  if (error) {
    const duplicado = error.message?.includes('unique') || error.code === '23505'
    return NextResponse.json(
      { erro: duplicado ? `SKU "${sku}" já existe` : 'Erro ao criar produto', detalhes: error.message },
      { status: duplicado ? 409 : 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
