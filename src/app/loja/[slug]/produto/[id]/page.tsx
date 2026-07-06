'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { corValida } from '@/lib/temasLoja'
import { setUltimaLoja } from '@/lib/ultimaLoja'
import CalculadoraFrete from '@/components/CalculadoraFrete'

// Descrição da Tray vem em HTML rico (p, br, etc.) + entities tipo
// &ccedil;, &atilde;. Renderizar cru mostra códigos. Strip tags
// preservando quebras de linha + decodifica TODAS as entities comuns
// portuguesas. Não usamos dangerouslySetInnerHTML pra evitar XSS.
const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  // Acentos portugueses minúsculos
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  atilde: 'ã', etilde: 'ẽ', itilde: 'ĩ', otilde: 'õ', utilde: 'ũ',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü',
  ccedil: 'ç', ntilde: 'ñ',
  // Maiúsculos
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  Atilde: 'Ã', Otilde: 'Õ',
  Ccedil: 'Ç',
  // Outros úteis
  ndash: '–', mdash: '—', hellip: '…',
  laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”',
  reg: '®', copy: '©', trade: '™', deg: '°',
}

// Tira tudo ligado à marca do fornecedor (P15 / prata de 15 reais) das
// descrições: nome, URLs, handles, e-mails, telefones/WhatsApp que vêm
// misturados em algumas descrições da Tray. NÃO mexe em "Prata 925".
function scrubMarcaFornecedor(s: string): string {
  return s
    // URLs (qualquer http/https — descrições não devem linkar externo)
    .replace(/https?:\/\/[^\s<>]+/gi, '')
    // wa.me e api.whatsapp links
    .replace(/(?:wa\.me|api\.whatsapp\.com)\/[^\s<>]*/gi, '')
    // handles e domínios do fornecedor
    .replace(/@\s*pratade15reais\w*/gi, '')
    .replace(/pratade15reais(\.com\.br)?/gi, '')
    // menções textuais da marca
    .replace(/prata\s*de\s*15\s*reais/gi, '')
    .replace(/\bp\s*15\b/gi, '')
    .replace(/prata\s*15\b/gi, '')
    // e-mails (qualquer)
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '')
    // telefones BR (com/sem DDI, com/sem parênteses, 8 ou 9 dígitos)
    .replace(/(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g, '')
    // remove linhas que ficam SÓ com "WhatsApp" / "Contato" / "Siga-nos" etc.
    .replace(/^\s*(WhatsApp|Whatsapp|Contato|Atendimento|Siga(\s|-)?nos|Instagram|Facebook|TikTok|Tik\s*Tok|Site|Visite)\s*[:.\-—]?\s*$/gim, '')
    // limpeza de pontuação/espaços órfãos
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/^[ \t.,;:!?\-—|/]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function limparHtml(html: string): string {
  const texto = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '') // remove resto de tags
    // Entities numéricas: &#123; ou &#xAB;
    .replace(/&#(x?)([0-9a-fA-F]+);/g, (_m, hex, num) => {
      const code = parseInt(num, hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    })
    // Entities nomeadas (&ccedil; etc.)
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return scrubMarcaFornecedor(texto)
}

type Produto = {
  id: string
  sku: string
  referencia: string | null
  nome: string
  descricao: string | null
  categoria: string | null
  preco: number
  preco_promo: number | null
  fotos: string[]
  estoque: number
  destaque: boolean
  lancamento: boolean
  tamanho: string | null
  cor: string | null
  ativo: boolean
  has_variation: boolean | null
}

type VariacaoUI = {
  variant_id: string
  ean: string | null
  modelo: string | null
  atributos: { tipo: string; valor: string }[]
  preco: number
  preco_promo: number | null
  foto: string | null
  disponivel: boolean
}

// Verdadeiro se a variação satisfaz TODAS as seleções (tipo->valor).
function casaSelecao(v: VariacaoUI, sel: Record<string, string>): boolean {
  const entries = Object.entries(sel)
  if (entries.length === 0) return false
  return entries.every(([tipo, valor]) =>
    v.atributos.some(a => a.tipo === tipo && a.valor === valor)
  )
}

type Revendedora = {
  id: string
  nome: string
  nome_loja: string | null
  whatsapp: string
  subdominio: string
  status: string
  cor_tema: string | null
}

export default function ProdutoPage({ params }: { params: { slug: string; id: string } }) {
  const { adicionar } = useCarrinho()
  const [revendedora, setRevendedora] = useState<Revendedora | null>(null)
  const [produto, setProduto] = useState<Produto | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [fotoAtiva, setFotoAtiva] = useState(0)
  // Variações Tray (tamanho, comprimento, etc). Carregadas sob demanda
  // depois que o produto principal renderiza — não bloqueia o LCP.
  const [variacoes, setVariacoes] = useState<VariacaoUI[]>([])
  const [variacoesLoading, setVariacoesLoading] = useState(false)
  // Seleção por dimensão (ex: { 'Modelo': 'Feminino', 'Tamanho do anel': '1,50cm=10' }).
  // A variação resolvida é a que casa com TODAS as seleções.
  const [selAtribs, setSelAtribs] = useState<Record<string, string>>({})
  // Descrição fica recolhida por padrão (ocupa muito espaço) — abre só no clique.
  const [descAberta, setDescAberta] = useState(false)
  // Referência real (ex "CESTA17-4") — buscada lazy do HTML público da Tray.
  const [refReal, setRefReal] = useState<string | null>(null)

  // Lembra esta loja p/ "voltar / continuar comprando" não cair na landing.
  useEffect(() => { setUltimaLoja(params.slug) }, [params.slug])

  // Busca a referência real (HTML público Tray) — lazy + cache no DB.
  useEffect(() => {
    let vivo = true
    fetch(`/api/produtos/${params.id}/referencia`)
      .then(r => (r.ok ? r.json() : { referencia: null }))
      .then((d: { referencia: string | null }) => { if (vivo) setRefReal(d.referencia) })
      .catch(() => {})
    return () => { vivo = false }
  }, [params.id])

  useEffect(() => {
    async function carregarTudo() {
      try {
        const [resRev, resProd] = await Promise.all([
          fetch(`/api/loja/${params.slug}`),
          fetch(`/api/produtos/${params.id}`),
        ])

        if (!resRev.ok) {
          setErro('loja')
          setLoading(false)
          return
        }
        if (!resProd.ok) {
          setErro('produto')
          setLoading(false)
          return
        }

        const [dataRev, dataProd] = await Promise.all([resRev.json(), resProd.json()])
        setRevendedora(dataRev)
        setProduto(dataProd)
      } catch (e) {
        console.error('Erro ao carregar:', e)
        setErro('rede')
      }
      setLoading(false)
    }
    carregarTudo()
  }, [params.slug, params.id])

  // Carrega variações depois do produto pronto (best-effort, não bloqueia
  // o LCP). 1ª chamada vai à Tray (~500ms-1s), depois fica em cache no DB.
  useEffect(() => {
    if (!produto?.has_variation) return
    let vivo = true
    setVariacoesLoading(true)
    fetch(`/api/produtos/${params.id}/variacoes`)
      .then(r => r.ok ? r.json() : { variacoes: [] })
      .then((d: { variacoes: VariacaoUI[] }) => {
        if (!vivo) return
        const vs = (d.variacoes || []).filter(v => v.disponivel)
        setVariacoes(vs)
        if (vs.length > 0) {
          // Seleção inicial: atributos da 1ª variação disponível.
          const inicial: Record<string, string> = {}
          vs[0].atributos.forEach(a => { inicial[a.tipo] = a.valor })
          setSelAtribs(inicial)
        }
      })
      .catch(() => {})
      .finally(() => { if (vivo) setVariacoesLoading(false) })
    return () => { vivo = false }
  }, [produto?.has_variation, params.id])

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function handleAdicionarCarrinho() {
    if (!produto) return
    // Preço da variação escolhida (tamanho maior pode custar mais); sem
    // variação usa o preço cheio do produto. O servidor revalida pelo cache.
    const sel = variacoes.find(v => casaSelecao(v, selAtribs)) || null
    const desc = sel?.atributos.map(a => `${a.tipo}: ${a.valor}`).join(' · ') || undefined
    const refVar = sel?.ean || sel?.modelo || undefined
    const precoItem = (sel?.preco && sel.preco > 0) ? sel.preco : produto.preco
    adicionar({
      id: produto.id,
      sku: produto.sku,
      nome: produto.nome,
      preco: precoItem,
      // Foto do produto (curada), não o thumbnail da variante.
      foto: (produto.fotos && produto.fotos.length > 0) ? produto.fotos[0] : '',
      slugRevendedora: params.slug,
      variantId: sel?.variant_id,
      variacao: desc,
      ref: refVar,
    })
  }

  // Valores ÚNICOS por tipo (ex: Modelo -> [Feminino, Masculino]; Tamanho do
  // anel -> 24 únicos). Hook: declarado ANTES dos early returns abaixo.
  const valoresPorTipo = useMemo<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {}
    for (const v of variacoes) {
      for (const a of v.atributos) {
        if (!m[a.tipo]) m[a.tipo] = []
        if (!m[a.tipo].includes(a.valor)) m[a.tipo].push(a.valor)
      }
    }
    // Ordena cada lista naturalmente: "1,45cm=9" antes de "1,55cm=12"
    // antes de "1,85cm=20" etc. Funciona pra texto puro ("Feminino"
    // antes de "Masculino") e pra valores com números misturados.
    for (const tipo of Object.keys(m)) {
      m[tipo].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }))
    }
    return m
  }, [variacoes])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ fontSize: 13, color: '#999', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
          Carregando...
        </div>
      </div>
    )
  }

  if (erro || !revendedora || !produto) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            {erro === 'loja' ? 'Loja não encontrada' : 'Produto não encontrado'}
          </h1>
          <Link href={`/loja/${params.slug}`} style={{ color: '#555', fontSize: 14, textDecoration: 'underline' }}>
            ← Voltar para a loja
          </Link>
        </div>
      </div>
    )
  }

  // Variação selecionada (se houver) sobrescreve preço/foto e adiciona
  // descrição "tamanho X" no WhatsApp.
  const variacaoSel = variacoes.find(v => casaSelecao(v, selAtribs)) || null
  // Preço da variação escolhida (tamanhos maiores custam mais na Tray); sem
  // variação (ou sem preço próprio) usa o preço cheio do produto.
  const precoFinal = (variacaoSel?.preco && variacaoSel.preco > 0) ? variacaoSel.preco : produto.preco
  const cor = corValida(revendedora.cor_tema)
  const temDesconto = false
  const descontoPct = 0

  // Galeria: sempre as fotos (boas, curadas) do produto. A foto da variante
  // da Tray é um thumbnail menor/recortado — não vale trocar a principal por ela.
  const fotos = (produto.fotos && produto.fotos.length > 0) ? produto.fotos : []
  const fotoPrincipal = fotos[fotoAtiva] || ''

  const descVar = variacaoSel?.atributos.map(a => `${a.tipo}: ${a.valor}`).join(' · ') || ''
  // Referência p/ montar o pedido: EAN da variação (único por tamanho) ou
  // o modelo do produto-pai. Sem isso a revendedora não consegue pedir.
  const refPedido = variacaoSel?.ean || variacaoSel?.modelo || refReal || produto.sku || ''
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: '-apple-system, "Inter", sans-serif' }}>

      <header style={{ background: 'white', borderBottom: '1px solid #EEE', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link
            href={produto.categoria
              ? `/loja/${params.slug}?cat=${encodeURIComponent(produto.categoria)}`
              : `/loja/${params.slug}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Voltar {produto.categoria ? `a ${produto.categoria}` : 'à loja'}
          </Link>
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, fontWeight: 700, color: cor }}>
            {revendedora.nome_loja || `Loja da ${revendedora.nome.split(' ')[0]}`}
          </div>
        </div>
      </header>

      <style>{`
        .pd-main { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
        .pd-grid { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: start; }
        @media (min-width: 760px) { .pd-grid { grid-template-columns: 1fr 1fr; gap: 48px; } }
        @media (max-width: 640px) { .pd-main { padding: 24px 14px; } }
        @media (max-width: 400px) { .pd-main { padding: 20px 10px; } }
      `}</style>
      <div className="pd-main">
        <div className="pd-grid">

          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{ aspectRatio: '1', background: '#F5F5F5', borderRadius: 16, overflow: 'hidden', border: '1px solid #EEE', position: 'relative' }}>
              {fotoPrincipal ? (
                <img
                  src={fotoPrincipal}
                  alt={produto.nome}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                  💎
                </div>
              )}
              {temDesconto && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: '#DC2626', color: 'white', fontSize: 12, padding: '6px 12px', borderRadius: 14, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                  -{descontoPct}%
                </div>
              )}
            </div>

            {fotos.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {fotos.map((foto, i) => (
                  <button
                    key={i}
                    onClick={() => setFotoAtiva(i)}
                    style={{
                      flexShrink: 0,
                      width: 72,
                      height: 72,
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '2px solid',
                      borderColor: fotoAtiva === i ? '#1D1D1D' : '#EEE',
                      background: '#F5F5F5',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <img
                      src={foto}
                      alt={`${produto.nome} - foto ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#999', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
              {produto.categoria || 'Joia 925'}
            </div>

            <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 32, fontWeight: 700, color: '#1D1D1D', letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 16 }}>
              {produto.nome}
            </h1>

            <div style={{ marginBottom: 8 }}>
              {/* "A partir de": tem variações (tamanhos com preços diferentes)
                  e ainda não escolheu uma — o preço base é o de partida. */}
              {produto.has_variation && !variacaoSel && (
                <div style={{ fontSize: 13, color: '#777', fontWeight: 600, marginBottom: 2 }}>A partir de</div>
              )}
              {temDesconto ? (
                <>
                  <div style={{ fontSize: 15, color: '#999', textDecoration: 'line-through', marginBottom: 4 }}>
                    {formatBRL(produto.preco)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#DC2626' }}>
                      {formatBRL(precoFinal)}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1D1D1D' }}>
                  {formatBRL(precoFinal)}
                </div>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#777', marginBottom: 24 }}>
              ou 6x de {formatBRL(precoFinal / 6)} sem juros
            </div>

            {(produto.tamanho || produto.cor || produto.sku || refReal) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {refReal && (
                  <div style={{ padding: '8px 14px', background: 'white', border: '1px solid #EEE', borderRadius: 10, fontSize: 13, color: '#1D1D1D' }}>
                    <span style={{ color: '#999', fontWeight: 500 }}>Referência: </span>
                    <span style={{ fontWeight: 600 }}>{refReal}</span>
                  </div>
                )}
                {produto.tamanho && (
                  <div style={{ padding: '8px 14px', background: 'white', border: '1px solid #EEE', borderRadius: 10, fontSize: 13, color: '#1D1D1D' }}>
                    <span style={{ color: '#999', fontWeight: 500 }}>Tamanho: </span>
                    <span style={{ fontWeight: 600 }}>{produto.tamanho}</span>
                  </div>
                )}
                {produto.cor && (
                  <div style={{ padding: '8px 14px', background: 'white', border: '1px solid #EEE', borderRadius: 10, fontSize: 13, color: '#1D1D1D' }}>
                    <span style={{ color: '#999', fontWeight: 500 }}>Cor: </span>
                    <span style={{ fontWeight: 600 }}>{produto.cor}</span>
                  </div>
                )}
                {produto.sku && (
                  <div style={{ padding: '8px 14px', background: 'white', border: '1px solid #EEE', borderRadius: 10, fontSize: 13, color: '#999' }}>
                    <span style={{ fontWeight: 500 }}>SKU: </span>
                    <span style={{ fontWeight: 600, color: '#555' }}>{produto.sku}</span>
                  </div>
                )}
              </div>
            )}

            {produto.descricao && (
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #EEE', marginBottom: 24, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setDescAberta(v => !v)}
                  aria-expanded={descAberta}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, padding: '16px 20px', background: 'transparent', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                    Descrição
                  </span>
                  <span style={{ fontSize: 18, color: '#999', lineHeight: 1, transform: descAberta ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                    ⌄
                  </span>
                </button>
                {descAberta && (
                  <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, margin: 0, padding: '0 20px 20px', whiteSpace: 'pre-wrap' }}>
                    {limparHtml(produto.descricao)}
                  </p>
                )}
              </div>
            )}

            {produto.estoque > 0 && produto.estoque <= 5 && (
              <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 16, fontWeight: 600 }}>
                Restam apenas {produto.estoque} {produto.estoque === 1 ? 'unidade' : 'unidades'}!
              </div>
            )}

            {/* Seletor de variações Tray (tamanho/cor/etc) — só aparece se
                o produto tem variações na Tray. Atualiza preço + foto +
                mensagem WhatsApp ao selecionar. */}
            {produto.has_variation && (
              <div style={{ marginBottom: 20 }}>
                {variacoesLoading && variacoes.length === 0 && (
                  <div style={{ fontSize: 12, color: '#999', padding: '8px 0' }}>
                    Carregando opções...
                  </div>
                )}
                {Object.entries(valoresPorTipo).map(([tipo, valores]) => (
                  <div key={tipo} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                      {tipo}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {valores.map(valor => {
                        const sel = selAtribs[tipo] === valor
                        return (
                          <button
                            key={`${tipo}::${valor}`}
                            type="button"
                            onClick={() => setSelAtribs(prev => ({ ...prev, [tipo]: valor }))}
                            style={{
                              padding: '10px 16px',
                              borderRadius: 10,
                              border: sel ? `2px solid ${cor}` : '1.5px solid #EEE',
                              background: sel ? '#fafafa' : 'white',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: sel ? 700 : 500,
                              color: sel ? cor : '#1D1D1D',
                              fontFamily: 'inherit',
                              transition: 'border-color .15s',
                            }}
                          >
                            {valor}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Referência da variação escolhida — a revendedora usa pra
                    montar o pedido na Tray (EAN único por tamanho). */}
                {variacaoSel && (variacaoSel.ean || variacaoSel.modelo) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: '#fafafa', border: '1px dashed #DDD', borderRadius: 10, fontSize: 12, color: '#555' }}>
                    <span style={{ fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: .5, fontSize: 10 }}>
                      Referência do pedido
                    </span>
                    {variacaoSel.ean && (
                      <span><strong style={{ color: '#1D1D1D' }}>EAN:</strong> {variacaoSel.ean}</span>
                    )}
                    {variacaoSel.modelo && (
                      <span><strong style={{ color: '#1D1D1D' }}>Modelo:</strong> {variacaoSel.modelo}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleAdicionarCarrinho}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                padding: '16px 20px', borderRadius: 12,
                background: cor, color: 'white',
                fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                marginBottom: 12,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            >
              🛒  Adicionar ao Carrinho
            </button>

            <div style={{ marginTop: 24 }}>
              <CalculadoraFrete subtotal={precoFinal} qntItens={1} cor={cor} />
            </div>

            <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid #EEE' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#1D1D1D' }}>✦</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1D' }}>Prata 925</div>
                    <div style={{ fontSize: 11, color: '#777' }}>Legítima certificada</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#1D1D1D' }}>◇</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1D' }}>Frete</div>
                    <div style={{ fontSize: 11, color: '#777' }}>Para todo o Brasil</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#1D1D1D' }}>✓</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1D' }}>Garantia vitalícia</div>
                    <div style={{ fontSize: 11, color: '#777' }}>No teor do metal (prata 925).</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <footer style={{ background: '#1D1D1D', color: 'white', padding: '32px 24px', marginTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#999', letterSpacing: 2, textTransform: 'uppercase' }}>
          Joias 925 · Prata Legítima
        </div>
      </footer>
    </div>
  )
}