import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Cache de 60s na edge da Vercel. Produtos mudam só via sync diária da Tray,
// então 1 query/min por URL única é suficiente — sem impacto no catálogo visível.
export const revalidate = 60

export async function GET(request: Request) {
  const supabase = supabaseAdmin()

  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get('categoria')
  const subcategoria = searchParams.get('subcategoria')
  const busca = searchParams.get('busca')
  // Opcional: estoque mínimo (usado pela loja da revendedora p/ mostrar só
  // peças com bom estoque). Sem o param, comportamento inalterado.
  const estoqueMinRaw = searchParams.get('estoqueMin')
  const estoqueMin = estoqueMinRaw ? parseInt(estoqueMinRaw, 10) : 0

  let query = supabase
    .from('produtos')
    .select('id, sku, nome, descricao, categoria, subcategoria, preco, preco_promo, fotos, estoque, destaque, destaque_tray, lancamento, tamanho, cor, has_variation')
    .eq('ativo', true)
    .gt('estoque', 0)
    .order('destaque', { ascending: false })
    .order('destaque_tray', { ascending: false })
    // Antes ordenava alfabeticamente, o que clusterizava todas as
    // "Alianças X" no topo da categoria Anéis (10 primeiras eram só
    // alianças). Ordenando por SKU (numérico-ish) os produtos ficam
    // misturados — usuária vê variedade real do catálogo.
    .order('sku', { ascending: false })

  if (Number.isFinite(estoqueMin) && estoqueMin > 0) {
    query = query.gte('estoque', estoqueMin)
  }

  if (categoria && categoria !== 'Tudo') {
    query = query.eq('categoria', categoria)
  }

  if (subcategoria) {
    query = query.eq('subcategoria', subcategoria)
  }

  if (busca) {
    // Busca ABERTA: normaliza (minúsculo + sem acento), quebra em palavras e
    // exige que CADA palavra apareça no texto de busca (nome + descrição +
    // categoria + subcategoria + sku, via coluna gerada `busca_texto`). Assim
    // "trevo brinco", "coracao" (sem acento) etc. acham. Sinônimos PT/ES
    // cobrem quem procura em espanhol (ex.: "suerte"/"sorte" → "trevo").
    const SINONIMOS: Record<string, string[]> = {
      sorte: ['trevo'], suerte: ['trevo'], trebol: ['trevo'], clover: ['trevo'],
      corazon: ['coracao'], heart: ['coracao'],
      ojo: ['olho grego'], perla: ['perola'], pearl: ['perola'],
      anillo: ['anel'], ring: ['anel'],
      pulsera: ['pulseira'], collar: ['colar', 'corrente', 'gargantilha'],
      pendiente: ['brinco'], arete: ['brinco'], aros: ['argola', 'brinco'],
      cadena: ['corrente'], dije: ['pingente', 'berloque'], colgante: ['pingente'],
      estrella: ['estrela'], luna: ['lua'], mariposa: ['borboleta'],
      cruz: ['cruz', 'crucifixo'], corazones: ['coracao'],
    }
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const tokens = norm(busca).replace(/[,%()]/g, ' ').split(/\s+/).filter(t => t.length >= 2)
    for (const t of tokens) {
      const variantes = Array.from(new Set([t, ...(SINONIMOS[t] || [])]))
      // Cada palavra é um grupo OR (a palavra OU seus sinônimos); grupos são
      // ANDados entre si (chamadas .or() sucessivas) → todas as palavras batem.
      query = query.or(variantes.map(v => `busca_texto.ilike.%${v}%`).join(','))
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ erro: 'Erro ao buscar produtos', detalhes: error.message }, { status: 500 })
  }

  // Árvore de categorias construída a partir dos dados já buscados acima —
  // evita um segundo SELECT desnecessário ao banco.
  const MIN_PRODUTOS_CATEGORIA = 15
  const MIN_PRODUTOS_SUBCATEGORIA = 6

  // contagem[categoria] = { total, subs: { nome -> count } }
  const contagem = new Map<string, { total: number; subs: Map<string, number> }>()
  for (const c of data || []) {
    if (!c.categoria) continue
    let nó = contagem.get(c.categoria)
    if (!nó) { nó = { total: 0, subs: new Map() }; contagem.set(c.categoria, nó) }
    nó.total++
    if (c.subcategoria) {
      nó.subs.set(c.subcategoria, (nó.subs.get(c.subcategoria) || 0) + 1)
    }
  }

  const arvore = Array.from(contagem.entries())
    .filter(([, n]) => n.total >= MIN_PRODUTOS_CATEGORIA)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([nome, n]) => ({
      nome,
      count: n.total,
      subcategorias: Array.from(n.subs.entries())
        .filter(([, sn]) => sn >= MIN_PRODUTOS_SUBCATEGORIA)
        .sort((a, b) => b[1] - a[1])
        .map(([sn, sc]) => ({ nome: sn, count: sc })),
    }))

  // Backward-compat: array só com nomes.
  const categorias = arvore.map(c => c.nome)

  return NextResponse.json({
    produtos: data || [],
    categorias,
    arvore,
    total: (data || []).length,
  })
}