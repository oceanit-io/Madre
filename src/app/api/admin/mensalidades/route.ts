import { NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'
import { MENSALIDADE_VALOR, situacaoMensalidade } from '@/lib/mensalidade'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = supabaseAdmin()

  const { searchParams } = new URL(request.url)
  const busca = (searchParams.get('busca') || '').replace(/[,%()]/g, ' ').trim()

  let query = supabase
    .from('revendedoras')
    .select(
      'id, nome, nome_loja, subdominio, whatsapp, status, saldo_disponivel, mensalidade_vence_em, mensalidade_isento'
    )
    .order('mensalidade_vence_em', { ascending: true, nullsFirst: true })

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,subdominio.ilike.%${busca}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar', detalhes: error.message },
      { status: 500 }
    )
  }

  const revendedoras = (data || []).map(r => {
    const { situacao, dias } = situacaoMensalidade(
      r.mensalidade_vence_em,
      !!r.mensalidade_isento
    )
    return {
      id: r.id,
      nome: r.nome,
      nome_loja: r.nome_loja,
      subdominio: r.subdominio,
      whatsapp: r.whatsapp,
      status: r.status,
      saldo_disponivel: Number(r.saldo_disponivel || 0),
      mensalidade_vence_em: r.mensalidade_vence_em,
      mensalidade_isento: !!r.mensalidade_isento,
      situacao,
      dias,
    }
  })

  return NextResponse.json({ valor: MENSALIDADE_VALOR, revendedoras })
}
