// A "Referência" real da peça (ex: "CESTA17-4") NÃO vem na API pública
// (web_api só traz `model`, ex "11A30//N"). Mas ela está embutida no HTML
// da página pública do produto como `"reference":"CESTA17-4"`.
//
// Esta função pega a URL pública do produto (via web_api) e extrai a
// referência do HTML. Never throws — retorna null em qualquer falha.
// Usada de forma lazy (sob demanda + cache), nunca no sync em massa.

const TRAY_BASE =
  process.env.TRAY_BASE_URL || 'https://www.pratade15reais.com.br/web_api'

export async function buscarReferenciaTray(sku: string): Promise<string | null> {
  try {
    // 1) URL pública do produto
    const r = await fetch(`${TRAY_BASE}/products/${sku}`, { cache: 'no-store' })
    if (!r.ok) return null
    const d = (await r.json()) as { Product?: { url?: { http?: string; https?: string } } } | { url?: { http?: string; https?: string } }
    const p = (d as { Product?: { url?: { http?: string; https?: string } } }).Product || (d as { url?: { http?: string; https?: string } })
    const url = p?.url?.https || p?.url?.http
    if (!url || !/^https?:\/\//.test(url)) return null

    // 2) baixa o HTML e extrai TODAS as ocorrências de "reference":"XXX".
    // A referência do produto se repete (uma por variante); valores avulsos
    // (produtos relacionados, etc.) aparecem menos. Pegamos a MAIS frequente
    // e desescapamos o "\/" do JSON ("CESTA20-5\/6" -> "CESTA20-5/6").
    const h = await fetch(url, { cache: 'no-store' })
    if (!h.ok) return null
    const html = await h.text()
    const re = /"reference"\s*:\s*"([^"]+)"/g
    const freq: Record<string, number> = {}
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const v = m[1].replace(/\\\//g, '/').trim()
      // Descarta lixo de 1 caractere (ex "Q"); referências reais têm 2+.
      if (v.length < 2) continue
      freq[v] = (freq[v] || 0) + 1
    }
    // Mais frequente; empate -> a mais longa (ex "Q27-1" vence "Q27").
    const keys = Object.keys(freq)
    let best = ''
    let bestN = 0
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const n = freq[k]
      if (n > bestN || (n === bestN && k.length > best.length)) {
        bestN = n
        best = k
      }
    }
    return best || null
  } catch {
    return null
  }
}
