// Busca variações de um produto na Tray. A API tem 2 níveis:
//   1) /products/{sku}    -> { has_variation, Variant: [{id:"24346"}, {id:"24348"}] }
//   2) /variants/{id}     -> { Variant: { Sku:[{type,value}], price, available, ... }
//
// Como o endpoint de lista pega só IDs, fazemos fetch paralelo (Promise.all)
// pra cada variant. Tipicamente 3-7 variantes por produto (tamanhos de corrente,
// p.ex.) — sub-segundo no total.

const TRAY_BASE =
  process.env.TRAY_BASE_URL || 'https://www.pratade15reais.com.br/web_api'

export type VariacaoAtributo = { tipo: string; valor: string }

export type VariacaoNormalizada = {
  variant_id: string               // id Tray da variação
  ean: string | null               // código de barras único por tamanho (referência p/ pedido)
  modelo: string | null            // model/referência do produto-pai (ex "1011F160//N")
  atributos: VariacaoAtributo[]   // [{tipo:"Tamanho da Corrente", valor:"60cm"}]
  preco: number                    // preço CHEIO da variant
  preco_promo: number | null       // promo se houver
  foto: string | null              // imagem ilustrativa (https)
  disponivel: boolean
}

type TrayProductLite = {
  has_variation?: number | string
  model?: string
  Variant?: Array<{ id: string | number }>
}

type TrayVariantDetalhe = {
  id: string | number
  ean?: string | number
  price?: string | number
  promotional_price?: string | number
  available?: string | number
  illustrative_image?: { http?: string; https?: string }
  VariantImage?: Array<{ http?: string; https?: string }>
  Sku?: Array<{ type: string; value: string }>
}

export async function buscarVariacoes(sku: string): Promise<VariacaoNormalizada[]> {
  // 1) Lista de variant_ids do produto
  const r = await fetch(`${TRAY_BASE}/products/${sku}`, { cache: 'no-store' })
  if (!r.ok) return []
  const raw = await r.text()
  if (!raw || raw.length < 20) return []
  let d: { Product?: TrayProductLite } | TrayProductLite
  try {
    d = JSON.parse(raw)
  } catch {
    return []
  }
  const p = (d as { Product?: TrayProductLite }).Product || (d as TrayProductLite)
  if (String(p.has_variation) !== '1') return []
  const modelo = (p.model || '').toString().trim() || null
  const ids = (p.Variant || []).map(v => String(v.id)).filter(Boolean)
  if (ids.length === 0) return []

  // 2) Fetch paralelo de cada variant
  const detalhes = await Promise.all(
    ids.map(async (id): Promise<VariacaoNormalizada | null> => {
      try {
        const rv = await fetch(`${TRAY_BASE}/variants/${id}`, { cache: 'no-store' })
        if (!rv.ok) return null
        const txt = await rv.text()
        if (!txt) return null
        const obj = JSON.parse(txt) as { Variant?: TrayVariantDetalhe }
        const v = obj?.Variant
        if (!v) return null
        const fotoVar = v.illustrative_image?.https || v.illustrative_image?.http ||
                        v.VariantImage?.[0]?.https || v.VariantImage?.[0]?.http || null
        return {
          variant_id: String(v.id),
          ean: v.ean != null && String(v.ean).trim() ? String(v.ean).trim() : null,
          modelo,
          atributos: (v.Sku || []).map(s => ({ tipo: s.type, valor: s.value })),
          preco: Number(v.price) || 0,
          preco_promo: v.promotional_price != null ? Number(v.promotional_price) || null : null,
          foto: fotoVar && /^https?:\/\//.test(fotoVar) ? fotoVar : null,
          disponivel: String(v.available) === '1',
        }
      } catch {
        return null
      }
    })
  )

  return detalhes.filter((x): x is VariacaoNormalizada => x !== null)
}
