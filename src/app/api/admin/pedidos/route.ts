import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { ABANDONO_HORAS } from '@/lib/pedidoStatus'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const revendedora = searchParams.get('revendedora') || ''
  const de = searchParams.get('de') || ''
  const ate = searchParams.get('ate') || ''
  const buscaRaw = searchParams.get('busca') || ''

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('per_page') || '20', 10) || 20)
  )

  let query = supabase.from('pedidos').select('*', { count: 'exact' })

  const limiteAbandono = new Date(
    Date.now() - ABANDONO_HORAS * 3600 * 1000
  ).toISOString()

  if (status === 'abandonados') {
    query = query
      .eq('status', 'aguardando_pagamento')
      .lt('created_at', limiteAbandono)
  } else if (status) {
    query = query.eq('status', status)
  }

  if (revendedora) {
    query = query.eq('slug_revendedora', revendedora)
  }
  if (de) query = query.gte('created_at', de)
  if (ate) query = query.lte('created_at', ate)

  // Sanitiza: vírgula e parênteses quebram o filtro `.or` do PostgREST
  const busca = buscaRaw.replace(/[,%()]/g, ' ').trim()
  if (busca) {
    const soDigitos = busca.replace(/\D/g, '')
    const conds = [
      `cliente_nome.ilike.%${busca}%`,
      `cliente_email.ilike.%${busca}%`,
      `numero_pedido.ilike.%${busca}%`,
      `cliente_cpf.ilike.%${busca}%`,
    ]
    if (soDigitos) conds.push(`cliente_cpf.ilike.%${soDigitos}%`)
    query = query.or(conds.join(','))
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar pedidos', detalhes: error.message },
      { status: 500 }
    )
  }

  const pedidos = data || []

  // Resolver nome da revendedora (slug_revendedora == revendedoras.subdominio)
  const slugs = Array.from(
    new Set(pedidos.map(p => p.slug_revendedora).filter(Boolean))
  ) as string[]

  const mapaRevendedoras = new Map<string, string>()
  if (slugs.length > 0) {
    const { data: revs } = await supabase
      .from('revendedoras')
      .select('nome, nome_loja, subdominio')
      .in('subdominio', slugs)
    for (const r of revs || []) {
      mapaRevendedoras.set(r.subdominio, r.nome_loja || r.nome)
    }
  }

  // Status da comissão (LEFT JOIN manual por pedido_id)
  const ids = pedidos.map(p => p.id)
  const mapaComissao = new Map<string, string>()
  if (ids.length > 0) {
    const { data: coms } = await supabase
      .from('comissoes')
      .select('pedido_id, status')
      .in('pedido_id', ids)
    for (const c of coms || []) {
      mapaComissao.set(c.pedido_id, c.status)
    }
  }

  const pedidosEnriquecidos = pedidos.map(p => ({
    ...p,
    nome_revendedora: p.slug_revendedora
      ? mapaRevendedoras.get(p.slug_revendedora) || null
      : null,
    status_comissao: mapaComissao.get(p.id) || null,
  }))

  // Lista de revendedoras com ao menos 1 pedido (para o filtro)
  const { data: todosSlugs } = await supabase
    .from('pedidos')
    .select('slug_revendedora')
    .not('slug_revendedora', 'is', null)

  const slugsUnicos = Array.from(
    new Set((todosSlugs || []).map(s => s.slug_revendedora).filter(Boolean))
  ) as string[]

  let revendedorasFiltro: { slug: string; nome: string }[] = []
  if (slugsUnicos.length > 0) {
    const { data: revs } = await supabase
      .from('revendedoras')
      .select('nome, nome_loja, subdominio')
      .in('subdominio', slugsUnicos)
    const mapNome = new Map(
      (revs || []).map(r => [r.subdominio, r.nome_loja || r.nome])
    )
    revendedorasFiltro = slugsUnicos.map(slug => ({
      slug,
      nome: mapNome.get(slug) || slug,
    }))
    revendedorasFiltro.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  const total = count || 0
  return NextResponse.json({
    pedidos: pedidosEnriquecidos,
    total,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
    revendedoras: revendedorasFiltro,
  })
}
