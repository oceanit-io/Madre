// Sync de catálogo desde Tray (web_api público — sem credenciais).
// Upsert por `sku` (= id Tray). Só toca colunas sincronizadas, então
// `destaque` (curado MANUAL no back office) é PRESERVADO.
//
// Categoria: agrupada por `category_id` da Tray (campo confiável). O nome
// bonito é aprendido do 1º segmento dos slugs que TÊM caminho de categoria
// (ex: "aneis-e-aliancas/produto" -> "Aneis E Aliancas"). Slugs que são só
// o nome do produto são ignorados p/ aprender nome (evita as ~334 lixo).
// `destaque_tray` = vem do `hot` da Tray.
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const TRAY_BASE =
  process.env.TRAY_BASE_URL || 'https://www.pratade15reais.com.br/web_api'
const PAGE_LIMIT = 50

type TrayProduct = {
  id: number | string
  name: string
  price: string | number
  available?: number | string
  available_for_purchase?: number | string
  category_id?: number | string
  slug?: string
  hot?: number | string
  has_variation?: number | string
  ProductImage?: { http?: string; https?: string }[]
}

function bonito(seg: string): string {
  return seg
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function db() {
  return supabaseAdmin()
}

function disponivelDe(p: TrayProduct): boolean {
  return (
    String(p.available) === '1' &&
    String(p.available_for_purchase ?? '1') !== '0'
  )
}

// Lê categoria pai + subcategoria do slug do produto. Tray usa paths tipo
// "correntes/com-pingente/corrente-45cm-..." onde o último segmento é o
// próprio produto. Então:
//   • 1º segmento  → categoria pai ("Correntes")
//   • 2º segmento  → subcategoria se houver 3+ partes ("Com Pingente")
//   • só 2 partes  → produto direto na categoria, sem subcategoria
function hierarquiaDoSlug(slug?: string): { categoria: string | null; subcategoria: string | null } {
  const partes = (slug || '').split('/').filter(Boolean)
  if (partes.length < 2) return { categoria: null, subcategoria: null }
  const categoria = bonito(partes[0]) || null
  const subcategoria = partes.length >= 3 ? bonito(partes[1]) || null : null
  return { categoria, subcategoria }
}

function mapRow(p: TrayProduct, catName: Map<number, string>) {
  const disp = disponivelDe(p)
  const fotos = (p.ProductImage || [])
    .map(i => i.https || i.http)
    // Filtra URLs reais: precisa começar com http(s):// e NÃO ser um
    // data: URL (a Tray às vezes injeta placeholders base64 de lazy-load
    // que entram como 1ª foto e quebram o produto).
    .filter((u): u is string => !!u && /^https?:\/\//.test(u) && !u.includes('data:image'))
  const row: Record<string, unknown> = {
    sku: String(p.id),
    nome: p.name,
    preco: Number(p.price) || 0, // preço CHEIO (ignora promotional_price)
    fotos,
    ativo: disp,
    estoque: disp ? 999 : 0,
    destaque_tray: String(p.hot) === '1',
    // has_variation = produto tem variações na Tray (tamanho/cor/etc).
    // Detalhe das variações é fetchado sob demanda em /api/produto/[id]/variacoes.
    has_variation: String(p.has_variation) === '1',
  }
  // NÃO grava referencia aqui: a referência real (ex "CESTA17-4") não vem
  // na API pública (só `model`). É buscada lazy do HTML em
  // /api/produtos/[id]/referencia e cacheada lá. Gravar model aqui sobrescreveria.

  // Hierarquia: prioriza o slug (path com pai/sub) sobre o aprendizado
  // por category_id, que perde a subcategoria. Cai em catName se o slug
  // não tem path (raro — produto raiz sem categoria visível).
  const hier = hierarquiaDoSlug(p.slug)
  const catPaiSlug = hier.categoria
  const catLegado = catName.get(Number(p.category_id))
  const cat = catPaiSlug || catLegado || null
  if (cat) row.categoria = cat
  row.subcategoria = hier.subcategoria // null limpa subcategoria velha quando produto muda de path
  return row
}

async function buscarTodos(): Promise<{ total: number; prods: TrayProduct[] }> {
  const first = await fetch(`${TRAY_BASE}/products?limit=${PAGE_LIMIT}&page=1`, {
    cache: 'no-store',
  })
  const fd = await first.json()
  const total = Number(fd?.paging?.total || 0)
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_LIMIT))
  const prods: TrayProduct[] = []
  const tomar = (d: { Products?: Array<Record<string, unknown>> }) =>
    (d.Products || []).map(w => (w.Product || w) as TrayProduct)
  prods.push(...tomar(fd))
  for (let page = 2; page <= totalPaginas; page++) {
    try {
      const r = await fetch(
        `${TRAY_BASE}/products?limit=${PAGE_LIMIT}&page=${page}`,
        { cache: 'no-store' }
      )
      prods.push(...tomar(await r.json()))
    } catch {
      /* pula página com erro */
    }
  }
  return { total, prods }
}

// category_id -> nome (o candidato mais frequente vindo de slugs com
// caminho de categoria, ex "correntes/...", "aneis-e-aliancas/...").
function aprenderCategorias(prods: TrayProduct[]): Map<number, string> {
  const votos = new Map<number, Map<string, number>>()
  for (const p of prods) {
    const cid = Number(p.category_id)
    if (!cid) continue
    const partes = (p.slug || '').split('/').filter(Boolean)
    if (partes.length < 2) continue // só nome do produto: não ensina nada
    const nome = bonito(partes[0])
    if (!nome) continue
    const m = votos.get(cid) || new Map<string, number>()
    m.set(nome, (m.get(nome) || 0) + 1)
    votos.set(cid, m)
  }
  const out = new Map<number, string>()
  Array.from(votos.entries()).forEach(([cid, m]) => {
    let melhor = ''
    let max = -1
    Array.from(m.entries()).forEach(([nome, n]) => {
      if (n > max) { max = n; melhor = nome }
    })
    if (melhor) out.set(cid, melhor)
  })
  return out
}

export type ResultadoSync = {
  dry: boolean
  total: number
  upserted: number
  categorias: number
  erros: number
  amostra?: unknown[]
  descricoes?: {
    pendentes_antes: number
    tentados: number
    atualizados: number
    erros: number
    amostra_erros?: string[]
  }
}

// ---- Backfill de descrições ----
//
// O endpoint /products (lista) da Tray NÃO devolve `description`, só
// retorna campos resumidos. A descrição rica só está em /products/{id}.
// Então fazemos backfill por SKU faltante, com concorrência limitada
// pra não estourar o timeout do cron (Hobby = 60s).
//
// Estratégia: cada execução pega até BACKFILL_MAX produtos sem descrição
// e busca individualmente. Em 5-6 corridas (manual ou diário) o catálogo
// inteiro fica preenchido. Steady state: só produtos novos da Tray
// (raros) precisam de backfill em cada ciclo.
const BACKFILL_MAX = 100
const BACKFILL_CONCURRENCY = 4 // não usado mais (sequential), mas exportado p/ docs

type TrayProductDetalhado = TrayProduct & {
  description?: string
  description_small?: string
}

async function backfillDescricoes(): Promise<{
  pendentes_antes: number
  tentados: number
  atualizados: number
  erros: number
  amostra_erros?: string[]
}> {
  const amostra_erros: string[] = []
  const logErr = (msg: string) => {
    if (amostra_erros.length < 5) amostra_erros.push(msg)
  }
  const supabase = db()
  // 1) Quantos faltam no total (informativo) + os próximos N a processar.
  const { count: pendentesTotal } = await supabase
    .from('produtos')
    .select('sku', { count: 'exact', head: true })
    .eq('ativo', true)
    .is('descricao', null)

  const { data: faltantes } = await supabase
    .from('produtos')
    .select('sku')
    .eq('ativo', true)
    .is('descricao', null)
    .limit(BACKFILL_MAX)

  if (!faltantes || faltantes.length === 0) {
    return { pendentes_antes: pendentesTotal || 0, tentados: 0, atualizados: 0, erros: 0 }
  }

  // Debug: marca que o backfill começou + 1ª SKU.
  logErr(`debug: backfill iniciado, primeira SKU=${faltantes[0]?.sku}, TRAY_BASE=${TRAY_BASE}`)

  let atualizados = 0
  let erros = 0
  // Sequential — fetch + UPDATE direto por SKU. Não usa upsert porque
  // upsert estava tentando INSERT (faltando colunas NOT NULL como `nome`).
  // Como sabemos que a linha existe (acabamos de ler dela), UPDATE por
  // sku é correto e barato (~50ms cada).
  for (const f of faltantes) {
    try {
      const r = await fetch(`${TRAY_BASE}/products/${f.sku}`, {
        cache: 'no-store',
        headers: { 'User-Agent': 'prata15-sync/1.0', 'Accept': 'application/json' },
      })
      if (!r.ok) {
        logErr(`sku ${f.sku} HTTP ${r.status}`)
        erros++
        continue
      }
      const raw = await r.text()
      if (!raw || raw.length < 20) {
        logErr(`sku ${f.sku} body vazio (${raw.length} bytes)`)
        erros++
        continue
      }
      const d = JSON.parse(raw) as { Product?: TrayProductDetalhado }
      const p: TrayProductDetalhado = d?.Product || (d as unknown as TrayProductDetalhado)
      const txt = (p.description || p.description_small || '').toString().trim()
      if (!txt) {
        logErr(`sku ${f.sku} sem desc (keys=${Object.keys(p || {}).slice(0, 6).join(',')})`)
        erros++
        continue
      }
      const { error: updErr } = await supabase
        .from('produtos')
        .update({ descricao: txt })
        .eq('sku', f.sku as string)
      if (updErr) {
        logErr(`sku ${f.sku} update erro: ${updErr.message}`)
        erros++
      } else {
        atualizados++
      }
    } catch (e) {
      logErr(`sku ${f.sku} exc: ${e instanceof Error ? e.message : String(e)}`)
      erros++
    }
  }

  return {
    pendentes_antes: pendentesTotal || 0,
    tentados: faltantes.length,
    atualizados,
    erros,
    amostra_erros,
  }
}

export async function syncTray(
  opts: { dry?: boolean } = {}
): Promise<ResultadoSync> {
  const supabase = db()
  const { total, prods } = await buscarTodos()
  const catName = aprenderCategorias(prods)

  if (opts.dry) {
    return {
      dry: true,
      total,
      upserted: 0,
      categorias: catName.size,
      erros: 0,
      amostra: prods.slice(0, 6).map(p => mapRow(p, catName)),
    }
  }

  const rows = prods
    .map(p => mapRow(p, catName))
    .filter(r => r.sku && r.nome)

  let upserted = 0
  let erros = 0
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const { error } = await supabase
      .from('produtos')
      .upsert(chunk, { onConflict: 'sku' })
    if (error) {
      erros++
      console.error('[tray] upsert chunk', i, error.message)
    } else {
      upserted += chunk.length
    }
  }

  // Backfill descrições (best-effort, não bloqueia o sync se falhar).
  let descricoes: ResultadoSync['descricoes'] | undefined
  try {
    descricoes = await backfillDescricoes()
  } catch (e) {
    console.error('[tray] backfill descrições erro:', e)
    descricoes = { pendentes_antes: -1, tentados: 0, atualizados: 0, erros: 1 }
  }

  await supabase
    .from('sync_estado')
    .update({
      valor: {
        total,
        upserted,
        categorias: catName.size,
        erros,
        descricoes,
        em: new Date().toISOString(),
      },
      atualizado_em: new Date().toISOString(),
    })
    .eq('chave', 'tray')

  return { dry: false, total, upserted, categorias: catName.size, erros, descricoes }
}
