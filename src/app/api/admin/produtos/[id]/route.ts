import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { features } from '@/lib/features'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })
  }

  let body: { destaque?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  if (typeof body.destaque !== 'boolean') {
    return NextResponse.json(
      { erro: 'Campo destaque (boolean) obrigatório' },
      { status: 400 }
    )
  }

  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('produtos')
    .update({ destaque: body.destaque })
    .eq('id', params.id)
    .select('id, destaque')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar', detalhes: error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data.id, destaque: data.destaque })
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!features.ecommerce) {
    return NextResponse.json({ erro: 'feature_indisponivel' }, { status: 404 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body inválido' }, { status: 400 })
  }

  const nome = (body.nome as string || '').trim()
  const preco = Number(body.preco)

  if (!nome) return NextResponse.json({ erro: 'Nome obrigatório' }, { status: 400 })
  if (!preco || preco <= 0) return NextResponse.json({ erro: 'Preço inválido' }, { status: 400 })

  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('produtos')
    .update({
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
    .eq('id', params.id)
    .select('id, sku, nome')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar produto', detalhes: error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  if (!features.ecommerce) {
    return NextResponse.json({ erro: 'feature_indisponivel' }, { status: 404 })
  }
  if (!UUID_RE.test(params.id || '')) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })
  }

  const supabase = supabaseAdmin()

  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao excluir produto', detalhes: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
