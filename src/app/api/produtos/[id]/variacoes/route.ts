// Variações de um produto Tray (tamanho/cor/etc).
//
// Estratégia lazy: 1ª chamada busca na Tray (paralelo, ~500ms-1s) e cacheia
// em `produtos.variacoes_cache`. Próximas chamadas retornam do cache na hora.
// Se `has_variation = false`, retorna [] sem fazer fetch.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarVariacoes, type VariacaoNormalizada } from '@/lib/trayVariacoes'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseAdmin()
  const url = new URL(request.url)
  const refresh = url.searchParams.get('refresh') === '1'

  const { data: produto, error } = await supabase
    .from('produtos')
    .select('id, sku, ativo, has_variation, variacoes_cache')
    .eq('id', params.id)
    .single()

  if (error || !produto) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })
  }
  if (!produto.ativo) {
    return NextResponse.json({ variacoes: [] })
  }
  if (!produto.has_variation) {
    return NextResponse.json({ variacoes: [] })
  }

  // Cache hit: retorna direto (a menos que ?refresh=1)
  const cache = produto.variacoes_cache as VariacaoNormalizada[] | null
  if (!refresh && Array.isArray(cache) && cache.length > 0) {
    return NextResponse.json({ variacoes: cache, cached: true })
  }

  // Miss: busca na Tray
  let variacoes: VariacaoNormalizada[] = []
  try {
    variacoes = await buscarVariacoes(produto.sku)
  } catch {
    // Best-effort: se a Tray falhar, retorna vazio mas não quebra a página
    return NextResponse.json({ variacoes: [], erro: 'tray_indisponivel' })
  }

  // Salva cache (fire-and-forget — não bloqueia resposta)
  if (variacoes.length > 0) {
    supabase
      .from('produtos')
      .update({ variacoes_cache: variacoes })
      .eq('id', produto.id)
      .then(() => {})
  }

  return NextResponse.json({ variacoes, cached: false })
}
