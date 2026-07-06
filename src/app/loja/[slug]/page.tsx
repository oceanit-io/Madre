'use client'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { corValida, fonteValida, fundoValido, bannerValido, heroTextoHexReal } from '@/lib/temasLoja'
import { setUltimaLoja } from '@/lib/ultimaLoja'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { fotoFixaCategoria } from '@/lib/categoriasFotos'
import { PorQuePrata925, Depoimentos, GarantiasRow, FormasPagamento } from '@/components/storefront/BlocosDeValor'

// Estoque mínimo para uma peça aparecer na loja da revendedora.
// Só mostra peças com bom estoque (evita vender algo que pode faltar).
const ESTOQUE_MIN_LOJA = 50

type Produto = {
  id: string
  sku: string
  nome: string
  descricao: string | null
  categoria: string | null
  preco: number
  preco_promo: number | null
  fotos: string[]
  estoque: number
  destaque: boolean
  destaque_tray: boolean
  lancamento: boolean
  tamanho: string | null
  cor: string | null
  has_variation: boolean | null
}

type Revendedora = {
  id: string
  nome: string
  nome_loja: string | null
  whatsapp: string
  whatsapp_mensagem: string | null
  cidade: string
  estado: string
  foto_url: string | null
  bio: string | null
  status: string
  subdominio: string
  cor_tema: string | null
  fonte: string | null
  cor_fundo: string | null
  banner_url: string | null
  banner_preset: string | null
  video_url: string | null
  cinta_cor: string | null
  mostrar_hero_texto: boolean | null
  banner_overlay: boolean | null
  hero_texto_cor: string | null
  hero_titulo: string | null
  hero_subtitulo: string | null
  mostrar_bloco_prata925: boolean | null
  mostrar_bloco_depoimentos: boolean | null
  mostrar_bloco_garantias: boolean | null
  instagram: string | null
  tiktok: string | null
  destaques_skus: (string | number)[] | null
}

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Deriva tons da cor da loja: "r, g, b" (p/ rgba) e um tom escuro (p/ gradientes).
function tonsDe(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lighten = (c: number) => Math.round(c + (255 - c) * 0.3)
  return {
    rgb: `${r}, ${g}, ${b}`,
    dark: `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`,
    light: `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`,
  }
}

// Interpreta a URL de vídeo: YouTube (embed) ou arquivo direto (.mp4/.webm…).
// Retorna null se não reconhecer (não renderiza nada).
function parseVideo(url: string | null | undefined): { tipo: 'youtube' | 'arquivo'; src: string } | null {
  const u = (url || '').trim()
  if (!u) return null
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (yt) return { tipo: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` }
  if (/^https?:\/\//.test(u) && /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(u)) {
    return { tipo: 'arquivo', src: u }
  }
  return null
}

// Card de produto (sempre preço cheio; promo é só da Tray).
// Botão de compra direto no card: peça SEM variação adiciona ao carrinho na
// hora; peça COM variação (tamanho) leva pra página escolher a opção.
function CardProduto({ p, slug, cor }: { p: Produto; slug: string; cor: string }) {
  const { adicionar } = useCarrinho()
  const [adicionado, setAdicionado] = useState(false)
  const foto = p.fotos && p.fotos.length > 0 ? p.fotos[0] : ''

  function quickAdd(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    adicionar({ id: p.id, sku: p.sku, nome: p.nome, preco: p.preco, foto, slugRevendedora: slug })
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 1600)
  }

  return (
    <Link
      href={`/loja/${slug}/produto/${p.id}`}
      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'block' }}
    >
      <div className="lj-card lj-reveal">
        <div className="lj-card-ph">
          {foto && <img src={foto} alt={p.nome} loading="lazy" />}
          {(p.destaque || p.destaque_tray) && (
            <div className="lj-badge" style={{ background: cor }}>
              ✨ Destaque
            </div>
          )}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div className="lj-card-cat">{p.categoria}</div>
          <div className="lj-card-nome">{p.nome}</div>
          <div className="lj-card-preco" style={{ color: cor }}>
            {p.has_variation && (
              <span style={{ display: 'block', fontSize: '0.6em', fontWeight: 600, opacity: 0.7, lineHeight: 1, marginBottom: 1 }}>A partir de</span>
            )}
            {fmtBRL(p.preco)}
          </div>
          <div className="lj-card-parc">ou 6x de {fmtBRL(p.preco / 6)} sem juros</div>
          {p.has_variation ? (
            <span className="lj-card-btn" style={{ background: cor }}>Ver opções →</span>
          ) : (
            <button
              type="button"
              onClick={quickAdd}
              className="lj-card-btn"
              style={{ background: adicionado ? '#16A34A' : cor }}
            >
              {adicionado ? '✓ Adicionado' : '+ Adicionar'}
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function LojaPage({ params }: { params: { slug: string } }) {
  const [revendedora, setRevendedora] = useState<Revendedora | null>(null)
  // Quando loja não está ativa, recebemos info pra mostrar mensagem clara.
  const [statusRevendedora, setStatusRevendedora] = useState<string | null>(null)
  // Distingue "loja não existe" (notfound) de "erro transitório" (transitorio).
  // Sem isso, qualquer blip mostrava "Loja não encontrada" numa loja real.
  const [erroCarga, setErroCarga] = useState<'notfound' | 'transitorio' | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  // Árvore: cada categoria pai com suas subcategorias e contagens.
  // Vem do /api/produtos junto com `categorias` (legacy flat).
  const [arvore, setArvore] = useState<{ nome: string; count: number; subcategorias: { nome: string; count: number }[] }[]>([])
  const [loading, setLoading] = useState(true)
  // URL params: ?cat=Aneis&sub=Solitarios&q=busca. Sincronizamos com a
  // URL pra que ao voltar de um produto (back button OU link "Voltar"
  // com cat preservada), o filtro continue ativo.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const urlCat = searchParams?.get('cat') || 'Tudo'
  const urlSub = searchParams?.get('sub') || null
  const urlBusca = searchParams?.get('q') || ''
  const [categoriaAtiva, setCategoriaAtiva] = useState(urlCat)
  // Subcategoria selecionada (null = mostra todos os produtos da categoria pai).
  const [subcategoriaAtiva, setSubcategoriaAtiva] = useState<string | null>(urlSub)
  // Quais categorias do drawer estão expandidas mostrando subcategorias.
  const [catsExpandidas, setCatsExpandidas] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState(urlBusca)
  const [menuCatAberto, setMenuCatAberto] = useState(false)
  // Ordenação dos produtos no modo categoria/busca (grid plano).
  // 'relevante' = mantém ordem da API (destaques + recentes primeiro).
  type Ordenacao = 'relevante' | 'menor_preco' | 'maior_preco' | 'nome_az'
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('relevante')

  // Sincroniza estado → URL (sem fazer scroll/refetch). Replace pra não
  // poluir histórico do back button.
  useEffect(() => {
    const q = new URLSearchParams()
    if (categoriaAtiva && categoriaAtiva !== 'Tudo') q.set('cat', categoriaAtiva)
    if (subcategoriaAtiva) q.set('sub', subcategoriaAtiva)
    if (busca) q.set('q', busca)
    const qs = q.toString()
    const novaUrl = qs ? `${pathname}?${qs}` : pathname
    // só replace se diferente do atual (evita loops)
    const atual = `${pathname}${searchParams?.toString() ? '?' + searchParams.toString() : ''}`
    if (novaUrl !== atual) router.replace(novaUrl, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaAtiva, subcategoriaAtiva, busca, pathname])

  // Lembra esta loja p/ os "voltar" do carrinho não jogarem o cliente na
  // landing de captação (raiz `/`).
  useEffect(() => { setUltimaLoja(params.slug) }, [params.slug])

  // Revela elementos (.lj-reveal) ao entrarem na viewport — animação de scroll.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const els = Array.from(document.querySelectorAll('.lj-reveal:not(.in)'))
    if (!('IntersectionObserver' in window)) {
      els.forEach(e => e.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            en.target.classList.add('in')
            io.unobserve(en.target)
          }
        })
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
    )
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [produtos, categoriaAtiva, busca, loading])

  useEffect(() => {
    async function carregarRevendedora() {
      // Reintenta em falha transitória (cold start, blip do Supabase, rede).
      // Só mostra erro depois de esgotar as tentativas — e distingue
      // "não existe" (404) de "indisponível agora" (rede/5xx).
      const MAX = 3
      for (let tentativa = 1; tentativa <= MAX; tentativa++) {
        try {
          const res = await fetch(`/api/loja/${params.slug}`)
          if (res.ok) {
            setRevendedora(await res.json())
            setLoading(false)
            return
          }
          if (res.status === 404) {
            setErroCarga('notfound')
            setLoading(false)
            return
          }
          if (res.status === 403) {
            // Loja inativa (pendente/suspensa): mensagem específica, não retry.
            try {
              const j = await res.json()
              if (j?.status_revendedora) setStatusRevendedora(j.status_revendedora)
            } catch { /* */ }
            setLoading(false)
            return
          }
          // 5xx ou outro → transitório: cai pro retry abaixo.
        } catch (e) {
          // Erro de rede → transitório: cai pro retry abaixo.
          console.error('Erro ao carregar revendedora (tentativa ' + tentativa + '):', e)
        }
        if (tentativa < MAX) {
          await new Promise(r => setTimeout(r, 600 * tentativa))
        }
      }
      // Esgotou as tentativas sem sucesso: é transitório, NÃO "não encontrada".
      setErroCarga('transitorio')
      setLoading(false)
    }
    carregarRevendedora()
  }, [params.slug])

  useEffect(() => {
    async function carregarProdutos() {
      try {
        const q = new URLSearchParams()
        if (categoriaAtiva !== 'Tudo') q.set('categoria', categoriaAtiva)
        if (subcategoriaAtiva) q.set('subcategoria', subcategoriaAtiva)
        if (busca) q.set('busca', busca)
        // Só peças com bom estoque na loja da revendedora (evita vender
        // algo que pode faltar). Threshold definido pela loja.
        q.set('estoqueMin', String(ESTOQUE_MIN_LOJA))
        const res = await fetch(`/api/produtos?${q.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        setProdutos(data.produtos || [])
        if (categorias.length === 0) {
          setCategorias(['Tudo', ...(data.categorias || [])])
        }
        // Árvore só é populada na primeira carga (não muda com o filtro).
        if (arvore.length === 0 && Array.isArray(data.arvore) && data.arvore.length > 0) {
          setArvore(data.arvore)
        }
      } catch (e) {
        console.error('Erro ao carregar produtos:', e)
      }
      setLoading(false)
    }
    carregarProdutos()
  }, [categoriaAtiva, subcategoriaAtiva, busca])

  // Destaques = 8 peças bonitas aleatórias. Pool: peças com foto que são
  // curadas (destaque manual ou hot da Tray); se não houver 8, qualquer
  // peça com foto. Embaralha 1× por carga (vitrine fresca a cada visita).
  const destaques = useMemo(() => {
    const comFoto = produtos.filter(p => p.fotos && p.fotos.length > 0)

    // 1) Destaques ESCOLHIDOS pela revendedora (na ordem dela). Se ela
    //    selecionou peças, mandam essas — não os padrão.
    const escolhidos = revendedora?.destaques_skus
    if (Array.isArray(escolhidos) && escolhidos.length > 0) {
      const porSku = new Map(produtos.map(p => [String(p.sku), p]))
      const lista = escolhidos
        .map(s => porSku.get(String(s)))
        .filter((p): p is NonNullable<typeof p> => !!p)
      if (lista.length > 0) return lista.slice(0, 12)
    }

    // 2) Padrão: peças curadas (destaque manual/Tray) embaralhadas; senão
    //    qualquer peça com foto. Vitrine fresca a cada visita.
    const curados = comFoto.filter(p => p.destaque || p.destaque_tray)
    const pool = curados.length >= 8 ? curados : comFoto
    const arr = [...pool]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, 8)
  }, [produtos, revendedora])

  // Setas dos Destaques: aparecem só quando há overflow horizontal e
  // indicam o lado que pode rolar. Atualizam ao rolar / redimensionar.
  const destRef = useRef<HTMLDivElement | null>(null)
  const [destNav, setDestNav] = useState({ canLeft: false, canRight: false })
  useEffect(() => {
    const el = destRef.current
    if (!el) return
    const atualizar = () => {
      setDestNav({
        canLeft: el.scrollLeft > 2,
        canRight: el.scrollLeft + el.clientWidth + 2 < el.scrollWidth,
      })
    }
    atualizar()
    el.addEventListener('scroll', atualizar, { passive: true })
    window.addEventListener('resize', atualizar)
    return () => {
      el.removeEventListener('scroll', atualizar)
      window.removeEventListener('resize', atualizar)
    }
  }, [produtos, loading])
  const rolarDest = (dx: number) => destRef.current?.scrollBy({ left: dx, behavior: 'smooth' })

  // Foto representativa de cada categoria — PRIMEIRO tenta a foto fixa
  // configurada em lib/categoriasFotos (lifestyle padrão pra TODAS as
  // lojas), e só se não existir mapping cai na heurística dinâmica.
  //
  // Heurística baseada no padrão da Tray:
  //   - foto _1_*.png = estúdio fundo branco (genérica)
  //   - foto _2_*.jpeg ou seguintes = lifestyle / close-up / detalhe
  //
  // Score por produto:
  //   +4 se tem ≥3 fotos (provável lifestyle no meio)
  //   +3 se tem 2 fotos
  //   +2 se a 2ª foto é JPG/JPEG (lifestyle hint)
  //   +1 se a 1ª foto NÃO é PNG (alguns produtos só têm lifestyle)
  // E usa a 2ª foto preferencialmente, fallback pra 1ª.
  const catFotos = useMemo(() => {
    type Cand = { score: number; foto: string }
    const best: Record<string, Cand> = {}

    function pontuar(fotos: string[]): { score: number; foto: string } {
      let score = 0
      const qt = fotos.length
      if (qt >= 3) score += 4
      else if (qt === 2) score += 3
      const segunda = (fotos[1] || '').toLowerCase()
      if (segunda.endsWith('.jpg') || segunda.endsWith('.jpeg')) score += 2
      const primeira = (fotos[0] || '').toLowerCase()
      if (qt === 1 && !primeira.endsWith('.png')) score += 1
      const foto = fotos[1] || fotos[0] // prefere a 2ª (lifestyle), cai pra 1ª
      return { score, foto }
    }

    for (const p of produtos) {
      if (!p.categoria || !p.fotos || p.fotos.length === 0) continue
      const cand = pontuar(p.fotos)
      const atual = best[p.categoria]
      if (!atual || cand.score > atual.score) {
        best[p.categoria] = cand
      }
    }

    const m: Record<string, string> = {}
    // 1ª passada: produtos com fotos → escolhe melhor candidato dinâmico.
    for (const cat of Object.keys(best)) m[cat] = best[cat].foto
    // 2ª passada: SOBREESCREVE com a foto FIXA mapeada (lifestyle padrão)
    // se ela existir pra essa categoria. Garante consistência visual entre
    // todas as lojas das revendedoras.
    for (const cat of Object.keys(m)) {
      const fixa = fotoFixaCategoria(cat)
      if (fixa) m[cat] = fixa
    }
    return m
  }, [produtos])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ fontSize: 13, color: '#999', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
          Carregando loja...
        </div>
      </div>
    )
  }

  if (!revendedora) {
    // Mensagem específica por status. Pendente = revendedora não pagou ainda.
    if (statusRevendedora === 'pendente') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 460 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
            <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1D1D1D', marginBottom: 12 }}>
              Complete o pagamento pra visualizar sua loja
            </h1>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 22 }}>
              Sua loja ainda não foi ativada. Pague a taxa única de <strong>R$ 39,90</strong> e ela fica disponível em poucos minutos ✨
            </p>
            {/* Pagar pelo painel: lá o link é DINÂMICO (order_nsu=cad_<id>),
                então o pagamento ativa a loja sozinho. Link estático direto
                aqui não atribuía o pagamento e exigia ativação manual. */}
            <a
              href="/dashboard"
              style={{ display: 'inline-block', background: '#DC2626', color: 'white', padding: '14px 28px', borderRadius: 12, fontSize: 14, fontWeight: 800, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10, boxShadow: '0 4px 14px rgba(220,38,38,.35)' }}
            >
              💳 Pagar R$ 39,90 agora
            </a>
            <div>
              <a href="/auth/login" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#777', textDecoration: 'none' }}>
                Já paguei → Fazer login
              </a>
            </div>
          </div>
        </div>
      )
    }
    if (statusRevendedora === 'suspensa') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1D1D1D', marginBottom: 12 }}>
              Loja temporariamente indisponível
            </h1>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7 }}>
              Esta loja está pausada no momento. Tente novamente mais tarde.
            </p>
          </div>
        </div>
      )
    }
    // Erro transitório (rede/servidor): NÃO é "não encontrada". Mostra opção
    // de recarregar, que costuma resolver na hora.
    if (erroCarga === 'transitorio') {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1D1D1D', marginBottom: 12 }}>
              Não foi possível carregar a loja agora
            </h1>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 22 }}>
              Parece um problema momentâneo de conexão. A loja está no ar — é só tentar de novo.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: '#1D1D1D', color: 'white', padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.5px' }}
            >
              🔄 Recarregar
            </button>
          </div>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1D1D1D', marginBottom: 8 }}>
            Loja não encontrada
          </h1>
          <p style={{ fontSize: 14, color: '#777', lineHeight: 1.6 }}>
            Esse link não existe. Confira se foi digitado corretamente.
          </p>
        </div>
      </div>
    )
  }

  const nomeLoja = revendedora.nome_loja || `Loja da ${revendedora.nome.split(' ')[0]}`
  // Link WhatsApp da revendedora pro botão flutuante. Mensagem genérica
  // pra iniciar conversa.
  const whatsappLimpo = (revendedora.whatsapp || '').replace(/\D/g, '')
  // Mensagem customizada pela revendedora ou default. Suporta {nome}
  // como placeholder pra primeiro nome dela (pra dar familiaridade).
  const primeiroNome = revendedora.nome.split(' ')[0]
  const msgCustom = (revendedora.whatsapp_mensagem || '').trim()
  const msgFinal = msgCustom
    ? msgCustom.replace(/\{nome\}/g, primeiroNome)
    : `Olá ${primeiroNome}! Vi sua loja 💎`
  const linkWhatsApp = whatsappLimpo.length >= 10
    ? `https://wa.me/55${whatsappLimpo}?text=${encodeURIComponent(msgFinal)}`
    : null
  const cor = corValida(revendedora.cor_tema)
  const tons = tonsDe(cor)
  const banner = bannerValido(revendedora.banner_preset)
  const video = parseVideo(revendedora.video_url)
  // Cor da cinta de avisos (default preto clássico). Fonte = a da loja.
  const cintaCor = corValida(revendedora.cinta_cor)
  // Fonte escolhida pela revendedora — aplicada em nome da loja + headings
  // (não em microcopy de cards p/ não pesar). Default = Playfair.
  const fontHead = fonteValida(revendedora.fonte).cssFamily
  // Cor de fundo da loja (lista fechada de tons claros — texto/cards
  // existentes funcionam sem ajuste de contraste).
  const fundo = fundoValido(revendedora.cor_fundo)

  // Vitrine = "Tudo" sem busca: mostra Destaques + seções por categoria
  // (não um grid plano de centenas de peças — fica organizado p/ vender).
  const cats = categorias.filter(c => c !== 'Tudo')
  const modoVitrine = categoriaAtiva === 'Tudo' && !busca
  // Banner: prioriza upload da revendedora; senão foto de uma peça destaque.
  // Quando cai pra fallback, prefere LIFESTYLE (2ª foto se for JPG) em vez
  // de foto estúdio com fundo branco (1ª foto _1_*.png).
  function fotoLifestyle(p?: { fotos?: string[] | null }): string {
    if (!p || !p.fotos || p.fotos.length === 0) return ''
    const segunda = p.fotos[1] || ''
    const seg = segunda.toLowerCase()
    if (seg.endsWith('.jpg') || seg.endsWith('.jpeg')) return segunda
    return p.fotos[0]
  }
  const bannerFoto =
    revendedora.banner_url ||
    fotoLifestyle(destaques.find(p => p.fotos?.length && p.fotos.length >= 2)) ||
    fotoLifestyle(destaques.find(p => p.fotos?.length)) ||
    fotoLifestyle(produtos.find(p => p.fotos?.length && p.fotos.length >= 2)) ||
    fotoLifestyle(produtos.find(p => p.fotos?.length)) ||
    ''
  const linkInstagram = revendedora.instagram ? `https://instagram.com/${revendedora.instagram}` : null
  const linkTiktok = revendedora.tiktok ? `https://tiktok.com/@${revendedora.tiktok}` : null
  const temRedes = !!(linkInstagram || linkTiktok)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: fundo.hex,
        fontFamily: '-apple-system, "Inter", sans-serif',
        ['--cor' as string]: cor,
        ['--cor-dark' as string]: tons.dark,
        ['--cor-light' as string]: tons.light,
        ['--cor-rgb' as string]: tons.rgb,
      } as CSSProperties}
    >
      <style>{`
        .prod-grid { display:grid; gap:12px; grid-template-columns:repeat(2,1fr); }
        @media (min-width:560px){ .prod-grid{ gap:20px; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); } }
        @media (min-width:900px){ .prod-grid{ gap:24px; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); } }

        @keyframes ljFadeUp { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:none} }
        @keyframes ljShine { 0%{transform:translateX(-130%) skewX(-18deg)} 55%,100%{transform:translateX(360%) skewX(-18deg)} }
        @keyframes ljFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
        @keyframes ljGrad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }

        .lj-reveal { opacity:0; transform:translateY(26px); transition:opacity .6s ease, transform .6s cubic-bezier(.2,.7,.3,1); }
        .lj-reveal.in { opacity:1; transform:none; }
        @media (prefers-reduced-motion:reduce){ .lj-reveal{opacity:1;transform:none;transition:none} .lj-hero-grad,.lj-blob,.lj-badge::after,.lj-btn::after{animation:none!important} }

        .lj-hdr { background:rgba(255,255,255,.82); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid rgba(0,0,0,.06); }
        .lj-hdr-grid { max-width:1200px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:14px; }
        .lj-hdr-left { display:flex; align-items:center; gap:12px; min-width:0; flex:1; }
        .lj-hdr-brand { display:flex; align-items:center; gap:12px; min-width:0; }
        .lj-hdr-brand-btn { background:transparent; border:none; padding:0; cursor:pointer; font-family:inherit; transition:opacity .15s; }
        .lj-hdr-brand-btn:hover { opacity:.78; }
        .lj-hdr-brand-btn:active { opacity:.6; }
        .lj-hdr-name { min-width:0; }
        .lj-hdr-actions { display:flex; align-items:center; gap:8px; justify-content:flex-end; flex-shrink:0; }
        .lj-hdr-burger { width:42px; height:42px; border-radius:11px; border:1px solid #EEE; background:#FAFAFA; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#1D1D1D; flex-shrink:0; transition:transform .15s, background .2s, border-color .2s, box-shadow .2s; padding:0; }
        .lj-hdr-burger:hover { background:#fff; border-color:rgba(var(--cor-rgb),.4); color:var(--cor); transform:scale(1.05); box-shadow:0 4px 12px rgba(var(--cor-rgb),.15); }
        .lj-hdr-burger:active { transform:scale(.96); }

        /* Drawer lateral (menu hambúrguer estilo ecommerce padrão) */
        .lj-drw-bd { position:fixed; inset:0; background:rgba(15,15,15,.5); z-index:150; animation:ljFadeIn .22s ease-out; backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px); }
        @keyframes ljFadeIn { from{opacity:0} to{opacity:1} }
        .lj-drw { position:fixed; top:0; left:0; bottom:0; width:min(330px, 86vw); background:#fff; z-index:151; display:flex; flex-direction:column; box-shadow:8px 0 36px rgba(0,0,0,.20); animation:ljDrwIn .28s cubic-bezier(.2,.7,.3,1); }
        @keyframes ljDrwIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        .lj-drw-hdr { display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid #F0F0F0; flex-shrink:0; }
        .lj-drw-title { font-size:16px; font-weight:800; color:#1D1D1D; letter-spacing:.3px; }
        .lj-drw-close { background:#FAFAFA; border:1px solid #EEE; border-radius:10px; cursor:pointer; padding:0; color:#555; width:34px; height:34px; display:flex; align-items:center; justify-content:center; transition:background .2s, color .2s, transform .15s; }
        .lj-drw-close:hover { background:#fff; color:var(--cor); transform:rotate(90deg); }
        .lj-drw-body { flex:1; overflow-y:auto; padding:8px 0 24px; }
        .lj-drw-sec { font-size:10.5px; letter-spacing:1.8px; text-transform:uppercase; font-weight:700; color:#A0A0A0; padding:16px 20px 8px; }
        .lj-drw-list { list-style:none; padding:0; margin:0; }
        .lj-drw-list button { display:flex; align-items:center; justify-content:space-between; width:100%; padding:13px 20px; background:transparent; border:none; border-left:3px solid transparent; cursor:pointer; font-family:inherit; font-size:14.5px; color:#1D1D1D; text-align:left; transition:background .15s, color .15s, border-color .2s; }
        .lj-drw-list button:hover { background:#FAFAFA; color:var(--cor); }
        .lj-drw-list button.sel { background:rgba(var(--cor-rgb),.07); border-left-color:var(--cor); font-weight:700; color:var(--cor); }
        .lj-drw-list button .check { color:var(--cor); font-weight:800; }
        .lj-drw-socs { display:flex; gap:10px; padding:10px 20px 0; }
        .lj-drw-soc { width:40px; height:40px; border-radius:50%; background:#FAFAFA; border:1px solid #EEE; display:inline-flex; align-items:center; justify-content:center; color:var(--cor); text-decoration:none; transition:transform .15s, border-color .2s, background .2s; }
        .lj-drw-soc:hover { transform:translateY(-2px); border-color:var(--cor); background:#fff; }
        .lj-drw-foot { padding:18px 20px; border-top:1px solid #F0F0F0; font-size:11.5px; color:#999; letter-spacing:.3px; }

        /* Botão flutuante WhatsApp da revendedora (canto inferior esquerdo
           pra não bater com o carrinho que fica à direita). Pulse sutil. */
        .lj-wa { position:fixed; bottom:24px; left:24px; z-index:90; width:56px; height:56px; border-radius:50%; background:#25D366; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(37,211,102,.45); text-decoration:none; transition:transform .2s; animation:ljWaPulse 2.6s ease-in-out infinite; }
        @media (max-width:640px) { .lj-wa { bottom:88px; } }
        .lj-wa:hover { transform:scale(1.08); }
        @keyframes ljWaPulse { 0%,100%{ box-shadow:0 8px 24px rgba(37,211,102,.45) } 50%{ box-shadow:0 10px 32px rgba(37,211,102,.72) } }
        @media (prefers-reduced-motion:reduce){ .lj-wa{ animation:none; } }

        /* Chip de filtro ativo (mostra "Mostrando: X · Limpar") */
        .lj-filt { display:inline-flex; align-items:center; gap:10px; margin-top:14px; padding:8px 12px 8px 14px; border-radius:20px; background:rgba(var(--cor-rgb),.08); color:var(--cor); font-size:12.5px; font-weight:600; }
        .lj-filt button { background:rgba(var(--cor-rgb),.15); border:none; color:var(--cor); width:22px; height:22px; border-radius:50%; cursor:pointer; font-size:13px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; padding:0; transition:background .2s; }
        .lj-filt button:hover { background:rgba(var(--cor-rgb),.28); }

        .lj-hero { position:relative; overflow:hidden; isolation:isolate; }
        .lj-hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .lj-hero-grad { position:absolute; inset:0; background:linear-gradient(135deg, var(--cor-light), var(--cor) 60%, var(--cor-dark)); background-size:200% 200%; animation:ljGrad 14s ease infinite; }
        .lj-blob { position:absolute; border-radius:50%; filter:blur(46px); pointer-events:none; mix-blend-mode:screen; opacity:.5; }
        .lj-blob-1 { width:320px; height:320px; background:rgba(255,255,255,.5); top:-90px; right:-60px; animation:ljFloat 9s ease-in-out infinite; }
        .lj-blob-2 { width:260px; height:260px; background:rgba(var(--cor-rgb), .95); bottom:-100px; left:-60px; animation:ljFloat 11s ease-in-out infinite reverse; }
        .lj-hero-content { position:relative; z-index:2; padding:84px 24px; text-align:center; max-width:820px; margin:0 auto; }
        .lj-eyebrow { display:inline-block; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#fff; font-weight:700; margin-bottom:18px; padding:7px 16px; border-radius:30px; background:rgba(255,255,255,.16); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,.28); }
        .lj-hero-title { font-size:clamp(36px,6vw,58px); font-weight:800; color:#fff; letter-spacing:-1.2px; line-height:1.1; margin-bottom:16px; text-shadow:0 4px 24px rgba(0,0,0,.28); }
        .lj-hero-title em { font-style:italic; color:rgba(255,255,255,.86); }
        .lj-hero-bio { font-size:15.5px; color:rgba(255,255,255,.93); line-height:1.7; max-width:540px; margin:0 auto; }

        .lj-card { background:#fff; border-radius:18px; overflow:hidden; border:1px solid rgba(0,0,0,.05); box-shadow:0 2px 10px rgba(0,0,0,.04); transition:transform .28s cubic-bezier(.2,.7,.3,1), box-shadow .28s; height:100%; }
        .lj-card:hover { transform:translateY(-7px); box-shadow:0 20px 44px rgba(var(--cor-rgb), .22); }
        .lj-card-ph { position:relative; padding-top:100%; background:#F3F3F3; overflow:hidden; }
        .lj-card-ph img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .55s cubic-bezier(.2,.7,.3,1); }
        .lj-card:hover .lj-card-ph img { transform:scale(1.08); }
        .lj-badge { position:absolute; top:12px; left:12px; color:#fff; font-size:10px; padding:5px 11px; border-radius:20px; letter-spacing:1px; text-transform:uppercase; font-weight:700; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,.18); }
        .lj-badge::after { content:''; position:absolute; top:0; left:0; width:35%; height:100%; background:linear-gradient(120deg, transparent, rgba(255,255,255,.7), transparent); animation:ljShine 3.6s ease-in-out infinite; }
        .lj-card-cat { font-size:10px; color:#aaa; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; margin-bottom:6px; }
        .lj-card-nome { font-family:'Playfair Display', Georgia, serif; font-size:15px; color:#1D1D1D; margin-bottom:8px; line-height:1.3; font-weight:600; min-height:40px; }
        .lj-card-preco { font-size:19px; font-weight:800; }
        .lj-card-parc { font-size:11px; color:#999; margin-top:3px; }
        .lj-card-btn { display:block; width:100%; margin-top:12px; padding:10px 12px; border-radius:11px; border:none; color:#fff; font-weight:700; font-size:13px; cursor:pointer; font-family:inherit; text-align:center; letter-spacing:.2px; box-shadow:0 6px 16px rgba(var(--cor-rgb),.28); transition:transform .15s, box-shadow .2s, opacity .2s, background .25s; }
        .lj-card:hover .lj-card-btn { transform:translateY(-1px); }
        .lj-card-btn:hover { box-shadow:0 10px 22px rgba(var(--cor-rgb),.4); }

        .lj-btn { position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; text-decoration:none; font-weight:700; color:#fff; background:linear-gradient(135deg, var(--cor), var(--cor-dark)); box-shadow:0 8px 22px rgba(var(--cor-rgb), .32); transition:transform .2s, box-shadow .2s; }
        .lj-btn:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(var(--cor-rgb), .42); }
        .lj-btn::after { content:''; position:absolute; top:0; left:0; width:30%; height:100%; background:linear-gradient(120deg, transparent, rgba(255,255,255,.5), transparent); animation:ljShine 4.5s ease-in-out infinite; }

        .lj-soc { transition:transform .2s, border-color .2s, color .2s; }
        .lj-soc:hover { transform:translateY(-2px) scale(1.05); }

        .lj-stitle { position:relative; display:inline-block; }
        .lj-stitle::after { content:''; position:absolute; left:0; bottom:-8px; width:42px; height:3px; border-radius:3px; background:var(--cor); }

        /* Categorias em CÍRCULOS (estilo destaque/stories) abaixo do banner */
        .lj-cats-row { display:flex; gap:16px; overflow-x:auto; padding:6px 24px; scrollbar-width:none; -webkit-overflow-scrolling:touch; max-width:1200px; margin:0 auto; }
        .lj-cats-row::-webkit-scrollbar { display:none; }
        @media (min-width:820px){ .lj-cats-row{ flex-wrap:wrap; justify-content:center; overflow:visible; } }
        .lj-catc { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:9px; background:none; border:none; cursor:pointer; padding:0; width:84px; }
        .lj-catc-ring { width:76px; height:76px; border-radius:50%; padding:3px; background:linear-gradient(135deg, var(--cor), var(--cor-dark)); box-shadow:0 6px 16px rgba(var(--cor-rgb), .28); transition:transform .25s cubic-bezier(.2,.7,.3,1); }
        .lj-catc:hover .lj-catc-ring { transform:translateY(-4px) scale(1.05); }
        .lj-catc-ring img { width:100%; height:100%; border-radius:50%; object-fit:cover; border:2.5px solid #fff; display:block; }
        .lj-catc-ph { width:100%; height:100%; border-radius:50%; border:2.5px solid #fff; background:var(--cor); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:26px; font-family:'Playfair Display',Georgia,serif; }
        .lj-catc-nome { font-size:11.5px; font-weight:600; color:#1D1D1D; text-align:center; line-height:1.2; }

        /* Destaques em CÍRCULOS (formato diferente do grid normal) */
        .lj-dest-row { display:flex; gap:18px; overflow-x:auto; padding:4px 2px 14px; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
        .lj-dest-row::-webkit-scrollbar { display:none; }
        .lj-destc { flex:0 0 auto; width:128px; text-decoration:none; color:inherit; display:flex; flex-direction:column; align-items:center; gap:10px; }
        .lj-destc-ring { position:relative; width:120px; height:120px; border-radius:50%; padding:3px; background:linear-gradient(135deg, var(--cor), var(--cor-dark)); box-shadow:0 8px 20px rgba(var(--cor-rgb),.28); transition:transform .28s cubic-bezier(.2,.7,.3,1); overflow:hidden; }
        .lj-destc:hover .lj-destc-ring { transform:translateY(-5px) scale(1.04); }
        .lj-destc-ring img { width:100%; height:100%; border-radius:50%; object-fit:cover; border:3px solid #fff; display:block; }
        .lj-destc-ring::after { content:''; position:absolute; top:0; left:0; width:38%; height:100%; background:linear-gradient(120deg, transparent, rgba(255,255,255,.55), transparent); animation:ljShine 4s ease-in-out infinite; border-radius:50%; }
        .lj-destc-nome { font-size:12px; font-weight:600; color:#1D1D1D; text-align:center; line-height:1.25; max-width:124px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:30px; }
        .lj-destc-preco { font-size:14.5px; font-weight:800; color:var(--cor); text-align:center; }

        /* Setas dos destaques: delicadas, só aparecem quando há overflow */
        .lj-dest-wrap { position:relative; }
        .lj-dest-arrow { position:absolute; top:calc(50% - 14px); transform:translateY(-50%); width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.94); border:1px solid rgba(0,0,0,.06); box-shadow:0 4px 14px rgba(0,0,0,.10); color:var(--cor); display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:5; transition:transform .2s, box-shadow .2s; padding:0; }
        .lj-dest-arrow:hover { transform:translateY(-50%) scale(1.08); box-shadow:0 8px 22px rgba(var(--cor-rgb),.20); }
        .lj-dest-arrow-left { left:-2px; }
        .lj-dest-arrow-right { right:-2px; }
        @media (max-width:560px) { .lj-dest-arrow { width:30px; height:30px; } }

        /* Barra de anúncios (topo) */
        .lj-annc { background:#111; color:#fff; overflow:hidden; white-space:nowrap; }
        .lj-annc-track { display:inline-block; padding:10px 0; font-size:12.5px; letter-spacing:.6px; font-weight:600; animation:ljMarquee 26s linear infinite; }
        .lj-annc-track span { padding:0 28px; }
        @keyframes ljMarquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @media (prefers-reduced-motion:reduce){ .lj-annc-track{ animation:none; } }

        /* Barra de confiança premium (mini-cards interativos, ícones SVG) */
        .lj-trust { background:transparent; }
        .lj-trust-in { max-width:1000px; margin:0 auto; padding:22px 20px; display:grid; grid-template-columns:repeat(1,1fr); gap:12px; }
        @media (min-width:520px){ .lj-trust-in{ grid-template-columns:repeat(3,1fr); gap:14px; } }
        @media (min-width:760px){ .lj-trust-in{ gap:16px; padding:26px 24px; } }
        .lj-trust-item { display:flex; align-items:center; gap:12px; background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:16px; padding:14px 16px; box-shadow:0 2px 8px rgba(0,0,0,.035); transition:transform .35s cubic-bezier(.2,.7,.3,1), box-shadow .35s, border-color .35s, opacity .6s ease; }
        .lj-trust-item:hover { transform:translateY(-5px); box-shadow:0 16px 34px rgba(var(--cor-rgb),.20); border-color:rgba(var(--cor-rgb),.4); }
        .lj-trust-ico { width:46px; height:46px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:rgba(var(--cor-rgb),.12); color:var(--cor); transition:transform .45s cubic-bezier(.34,1.56,.64,1), background .35s; }
        .lj-trust-item:hover .lj-trust-ico { transform:scale(1.15) rotate(-8deg); background:rgba(var(--cor-rgb),.20); }
        .lj-trust-ico svg { width:22px; height:22px; }
        .lj-trust-txt { line-height:1.25; min-width:0; }
        .lj-trust-txt strong { display:block; color:#1D1D1D; font-weight:700; font-size:13px; }
        .lj-trust-txt em { display:block; color:#8a8a8a; font-size:11px; font-weight:500; font-style:normal; margin-top:1px; }

      `}</style>

      <div className="lj-annc" style={{ background: cintaCor }}>
        <div className="lj-annc-track" style={{ fontFamily: fontHead }}>
          <span>✨ Frete grátis acima de R$250</span><span>💳 Até 6x sem juros</span><span>💎 Prata 925 legítima certificada</span><span>🚚 Enviamos para todo o Brasil</span>
          <span>✨ Frete grátis acima de R$250</span><span>💳 Até 6x sem juros</span><span>💎 Prata 925 legítima certificada</span><span>🚚 Enviamos para todo o Brasil</span>
        </div>
      </div>

      <header className="lj-hdr" style={{ padding: '16px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="lj-hdr-grid">
          <div className="lj-hdr-left">
            <button
              type="button"
              className="lj-hdr-burger"
              onClick={() => setMenuCatAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={menuCatAberto}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {/* Logo + nome funcionam como botão "início" — limpa filtros
                (categoria/subcategoria/busca) e rola pro topo. Padrão de
                ecommerce: clicar no brand sempre volta ao home. */}
            <button
              type="button"
              className="lj-hdr-brand lj-hdr-brand-btn"
              onClick={() => {
                setCategoriaAtiva('Tudo')
                setSubcategoriaAtiva(null)
                setBusca('')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              aria-label="Voltar ao início da loja"
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: revendedora.foto_url ? `url(${revendedora.foto_url}) center/cover` : cor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 22,
                border: '2px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,.14)',
              }}>
                {!revendedora.foto_url && revendedora.nome[0]?.toUpperCase()}
              </div>
              <div className="lj-hdr-name">
                <div style={{ fontFamily: fontHead, fontSize: 19, fontWeight: 700, color: cor, letterSpacing: -0.3, lineHeight: 1.1, textAlign: 'left' }}>
                  {nomeLoja}
                </div>
                <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginTop: 3, fontWeight: 500, textAlign: 'left' }}>
                  Joias 925 · {revendedora.cidade}/{revendedora.estado}
                </div>
              </div>
            </button>
          </div>

          <div className="lj-hdr-actions">
            {/* Atalho de busca: rola pro input embaixo do header */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('busca-loja-input')
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setTimeout(() => el.focus(), 350)
                }
              }}
              aria-label="Buscar"
              className="lj-soc"
              style={{ width: 38, height: 38, borderRadius: '50%', background: '#FAFAFA', border: '1px solid #EEE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cor, cursor: 'pointer', padding: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
            </button>
            {linkInstagram && (
              <a
                href={linkInstagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="lj-soc"
                style={{ width: 38, height: 38, borderRadius: '50%', background: '#FAFAFA', border: '1px solid #EEE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cor, textDecoration: 'none' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            )}
            {linkTiktok && (
              <a
                href={linkTiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="lj-soc"
                style={{ width: 38, height: 38, borderRadius: '50%', background: '#FAFAFA', border: '1px solid #EEE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: cor, textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Drawer lateral (estilo ecommerce padrão): categorias + redes. Abre
          pelo botão hambúrguer no canto superior esquerdo do header. */}
      {menuCatAberto && (
        <>
          <div className="lj-drw-bd" onClick={() => setMenuCatAberto(false)} aria-hidden />
          <aside className="lj-drw" role="dialog" aria-label="Menu da loja">
            <div className="lj-drw-hdr">
              <span className="lj-drw-title" style={{ fontFamily: fontHead, color: cor }}>Menu</span>
              <button
                type="button"
                onClick={() => setMenuCatAberto(false)}
                aria-label="Fechar menu"
                className="lj-drw-close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="lj-drw-body">
              <div className="lj-drw-sec">Categorias</div>
              <ul className="lj-drw-list">
                {/* "Tudo" sempre primeiro */}
                <li>
                  <button
                    type="button"
                    className={categoriaAtiva === 'Tudo' ? 'sel' : ''}
                    onClick={() => {
                      setCategoriaAtiva('Tudo')
                      setSubcategoriaAtiva(null)
                      setMenuCatAberto(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <span>Tudo</span>
                    {categoriaAtiva === 'Tudo' && <span className="check">✓</span>}
                  </button>
                </li>
                {/* Árvore: categoria pai + chevron quando tem subcategorias.
                    Click no nome aplica filtro da categoria. Click no chevron
                    apenas expande/recolhe (sem mudar filtro). */}
                {arvore.length > 0
                  ? arvore.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(cat => {
                      const selPai = cat.nome === categoriaAtiva && !subcategoriaAtiva
                      const aberta = catsExpandidas.has(cat.nome)
                      const temSubs = cat.subcategorias.length > 0
                      return (
                        <li key={cat.nome}>
                          <div style={{ display: 'flex', alignItems: 'stretch' }}>
                            <button
                              type="button"
                              className={selPai ? 'sel' : ''}
                              onClick={() => {
                                setCategoriaAtiva(cat.nome)
                                setSubcategoriaAtiva(null)
                                setMenuCatAberto(false)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }}
                              style={{ flex: 1 }}
                            >
                              <span>{cat.nome}</span>
                              {selPai && <span className="check">✓</span>}
                            </button>
                            {temSubs && (
                              <button
                                type="button"
                                onClick={() => {
                                  const novo = new Set(catsExpandidas)
                                  if (novo.has(cat.nome)) novo.delete(cat.nome); else novo.add(cat.nome)
                                  setCatsExpandidas(novo)
                                }}
                                aria-label={aberta ? 'Recolher' : 'Expandir'}
                                aria-expanded={aberta}
                                style={{
                                  width: 44, padding: 0, background: 'transparent',
                                  border: 'none', borderLeft: '1px solid #F4F4F4',
                                  cursor: 'pointer', color: '#999', fontSize: 16,
                                  transform: aberta ? 'rotate(180deg)' : 'none',
                                  transition: 'transform .15s, color .15s',
                                }}
                              >⌄</button>
                            )}
                          </div>
                          {aberta && temSubs && (
                            <ul className="lj-drw-list lj-drw-sublist">
                              {cat.subcategorias.map(sub => {
                                const selSub = subcategoriaAtiva === sub.nome && categoriaAtiva === cat.nome
                                return (
                                  <li key={sub.nome}>
                                    <button
                                      type="button"
                                      className={selSub ? 'sel' : ''}
                                      onClick={() => {
                                        setCategoriaAtiva(cat.nome)
                                        setSubcategoriaAtiva(sub.nome)
                                        setMenuCatAberto(false)
                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                      }}
                                      style={{ paddingLeft: 36, fontSize: 13.5 }}
                                    >
                                      <span>{sub.nome}</span>
                                      {selSub && <span className="check">✓</span>}
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </li>
                      )
                    })
                  : /* Fallback antes da árvore carregar — mantém compat */
                    cats.slice().sort((a, b) => a.localeCompare(b, 'pt-BR')).map(cat => {
                      const sel = cat === categoriaAtiva
                      return (
                        <li key={cat}>
                          <button
                            type="button"
                            className={sel ? 'sel' : ''}
                            onClick={() => {
                              setCategoriaAtiva(cat)
                              setSubcategoriaAtiva(null)
                              setMenuCatAberto(false)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                          >
                            <span>{cat}</span>
                            {sel && <span className="check">✓</span>}
                          </button>
                        </li>
                      )
                    })
                }
              </ul>
              {(linkInstagram || linkTiktok) && (
                <>
                  <div className="lj-drw-sec">Redes sociais</div>
                  <div className="lj-drw-socs">
                    {linkInstagram && (
                      <a href={linkInstagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="lj-drw-soc">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                      </a>
                    )}
                    {linkTiktok && (
                      <a href={linkTiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="lj-drw-soc">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="lj-drw-foot">
              {nomeLoja} · {revendedora.cidade}/{revendedora.estado}
            </div>
          </aside>
        </>
      )}

      {/* Hero/banner: SÓ no home (modoVitrine). Ao abrir uma categoria ou
          buscar, não repete o banner/hero pra não poluir — fica só o grid.
          Texto+overlay controlados pela revendedora (defaults true).
          banner_overlay=false c/ foto -> mostra a foto LIMPA (sem escurecer). */}
      {modoVitrine && (() => {
        const mostrarTexto = revendedora.mostrar_hero_texto !== false
        const aplicaOverlay = revendedora.banner_overlay !== false
        const semOverlay = !!bannerFoto && !aplicaOverlay
        // Cor do texto do hero (configurável). Default = branco.
        const heroCor = heroTextoHexReal(revendedora.hero_texto_cor, cor)
        return (
          <section className="lj-hero" style={semOverlay ? { minHeight: 340 } : undefined}>
            {bannerFoto && <img className="lj-hero-img" src={bannerFoto} alt="" aria-hidden />}
            {!semOverlay && (
              <div
                className="lj-hero-grad"
                style={{
                  opacity: bannerFoto ? 0.6 : 1,
                  ...(!bannerFoto && banner.css ? { background: banner.css, backgroundSize: '180% 180%' } : {}),
                }}
              />
            )}
            {!semOverlay && <span className="lj-blob lj-blob-1" />}
            {!semOverlay && <span className="lj-blob lj-blob-2" />}
            {mostrarTexto && (() => {
              const t = (revendedora.hero_titulo || '').trim()
              const s = (revendedora.hero_subtitulo || '').trim()
              const b = (revendedora.bio || '').trim()
              // Se tudo vazio, não renderiza nada sobre o banner.
              if (!t && !s && !b) return null
              return (
                <div className="lj-hero-content lj-reveal">
                  {/* Eyebrow só se tiver título/subtítulo (faz par com eles) */}
                  {(t || s) && (
                    <div className="lj-eyebrow" style={{ color: heroCor, borderColor: heroCor === '#FFFFFF' ? undefined : `${heroCor}40`, background: heroCor === '#FFFFFF' ? undefined : `${heroCor}1a` }}>
                      ✨ Prata 925 Legítima
                    </div>
                  )}
                  {(t || s) && (
                    <h1 className="lj-hero-title" style={{ fontFamily: fontHead, color: heroCor }}>
                      {t}
                      {t && s && <br />}
                      {s && (
                        <em style={{ color: heroCor, opacity: .86 }}>{s}</em>
                      )}
                    </h1>
                  )}
                  {b && (
                    <p className="lj-hero-bio" style={{ color: heroCor, opacity: heroCor === '#FFFFFF' ? .93 : .82 }}>
                      {b}
                    </p>
                  )}
                </div>
              )
            })()}
          </section>
        )
      })()}

      {/* Categorias em CÍRCULOS (estilo destaque/stories), logo abaixo do banner. */}
      {modoVitrine && cats.length > 0 && (
        <div className="lj-cats-row" style={{ paddingTop: 40, paddingBottom: 4 }}>
          {cats.map(cat => (
            <button
              key={cat}
              className="lj-catc lj-reveal"
              onClick={() => { setCategoriaAtiva(cat); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              aria-label={`Ver ${cat}`}
            >
              <span className="lj-catc-ring">
                {catFotos[cat]
                  ? <img src={catFotos[cat]} alt={cat} loading="lazy" />
                  : <span className="lj-catc-ph">{cat[0]?.toUpperCase()}</span>}
              </span>
              <span className="lj-catc-nome">{cat}</span>
            </button>
          ))}
        </div>
      )}

      {/* Vídeo opcional da loja (YouTube ou arquivo) — SÓ no home, não repete
          em categoria/busca. */}
      {modoVitrine && video && (
        <section style={{ maxWidth: 880, margin: '24px auto 0', padding: '0 24px' }}>
          <div className="lj-reveal" style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 34px rgba(0,0,0,.14)', aspectRatio: '16 / 9', background: '#000' }}>
            {video.tipo === 'youtube' ? (
              <iframe
                src={video.src}
                title="Vídeo da loja"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            ) : (
              <video src={video.src} controls playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        </section>
      )}

      {/* Barra de confiança premium: mini-cards interativos com ícones SVG. */}
      <div className="lj-trust" style={{ marginTop: 12 }}>
        <div className="lj-trust-in">
          {[
            {
              t: 'Prata 925', s: 'Legítima certificada',
              ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
            },
            {
              t: 'Enviamos pra todo Brasil', s: 'Envio rápido e seguro',
              ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="14" height="13" rx="1"/><path d="M15 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/></svg>,
            },
            {
              t: 'Até 6x sem juros', s: 'No cartão de crédito',
              ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
            },
          ].map((it, i) => (
            <div key={i} className="lj-trust-item lj-reveal" style={{ transitionDelay: `${i * 0.09}s` }}>
              <span className="lj-trust-ico">{it.ico}</span>
              <span className="lj-trust-txt"><strong>{it.t}</strong><em>{it.s}</em></span>
            </div>
          ))}
        </div>
      </div>

      {/* DESTAQUES — centrados, logo após a barra de confiança, pra ganhar ênfase. */}
      {modoVitrine && destaques.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 8px', textAlign: 'center' }}>
          <div className="lj-stitle lj-reveal" style={{ fontFamily: fontHead, fontSize: 24, fontWeight: 800, color: cor, marginBottom: 14 }}>
            ✨ Destaques
          </div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 20 }}>
            As peças mais lindas da loja
          </div>
          <div className="lj-dest-wrap">
            {destNav.canLeft && (
              <button
                type="button"
                className="lj-dest-arrow lj-dest-arrow-left"
                onClick={() => rolarDest(-320)}
                aria-label="Destaques anteriores"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div className="lj-dest-row" ref={destRef} style={{ justifyContent: 'center' }}>
              {destaques.map(p => {
                const foto = p.fotos?.[0] ?? ''
                return (
                  <Link key={`d-${p.id}`} href={`/loja/${params.slug}/produto/${p.id}`} className="lj-destc lj-reveal">
                    <span className="lj-destc-ring">
                      {foto
                        ? <img src={foto} alt={p.nome} loading="lazy" />
                        : <span className="lj-catc-ph">💎</span>}
                    </span>
                    <span className="lj-destc-nome">{p.nome}</span>
                    <span className="lj-destc-preco">{p.has_variation ? `A partir de ${fmtBRL(p.preco)}` : fmtBRL(p.preco)}</span>
                  </Link>
                )
              })}
            </div>
            {destNav.canRight && (
              <button
                type="button"
                className="lj-dest-arrow lj-dest-arrow-right"
                onClick={() => rolarDest(320)}
                aria-label="Mais destaques"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Bloco educacional "Por que Prata 925?" — só na vitrine (home) */}
      {modoVitrine && revendedora.mostrar_bloco_prata925 !== false && <PorQuePrata925 cor={cor} fontHead={fontHead} />}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 32px' }}>
        <div style={{ position: 'relative' }}>
          <input
            id="busca-loja-input"
            type="text"
            placeholder="Buscar joia... (ex: pulseira bola, anel, brinco)"
            value={busca}
            onChange={e => {
              const v = e.target.value
              setBusca(v)
              // Busca é GLOBAL: ao digitar, sai de qualquer categoria/sub
              // selecionada — senão a busca fica PRESA na categoria atual e
              // "não acha" peças que existem em outras (ex.: buscar "trevo"
              // dentro de "Anéis" não traz a pulseira de trevo).
              if (v && (categoriaAtiva !== 'Tudo' || subcategoriaAtiva)) {
                setCategoriaAtiva('Tudo')
                setSubcategoriaAtiva(null)
              }
            }}
            style={{
              width: '100%',
              padding: busca ? '14px 80px 14px 18px' : '14px 46px 14px 18px',
              border: `2px solid ${busca ? cor : '#E5E5E5'}`,
              borderRadius: 12,
              fontSize: 15,
              background: 'white',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color .15s, box-shadow .15s',
              boxShadow: busca ? `0 2px 12px rgba(0,0,0,.05)` : 'none',
            }}
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              style={{
                position: 'absolute',
                right: 46,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#F3F4F6',
                border: 'none',
                color: '#666',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#888"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
        </div>
        {/* Chip de filtro ativo: mostra a categoria/subcategoria escolhida e
            permite limpar. Trocar é feito pelo hambúrguer. */}
        {categoriaAtiva !== 'Tudo' && (
          <span className="lj-filt">
            <span>
              {subcategoriaAtiva
                ? `${categoriaAtiva} › ${subcategoriaAtiva}`
                : categoriaAtiva}
            </span>
            <button
              type="button"
              onClick={() => {
                setCategoriaAtiva('Tudo')
                setSubcategoriaAtiva(null)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              aria-label="Limpar filtro"
            >
              ×
            </button>
          </span>
        )}
      </div>


      {/* VITRINE (Tudo, sem busca): uma seção por categoria, cada com até 8
          peças e "Ver todos". Os Destaques são exibidos lá em cima, logo após
          a barra de confiança, pra ganhar ênfase. */}

      {modoVitrine && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
          {produtos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              Em breve novas peças nesta loja.
            </div>
          )}
          {cats.map(cat => {
            const itens = produtos.filter(p => p.categoria === cat)
            if (itens.length === 0) return null
            return (
              <section key={cat} style={{ marginBottom: 56 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
                  <div className="lj-stitle" style={{ fontFamily: fontHead, fontSize: 22, fontWeight: 800, color: '#1D1D1D' }}>
                    {cat}
                  </div>
                  <button
                    onClick={() => { setCategoriaAtiva(cat); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    style={{ background: 'none', border: 'none', color: cor, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: 0 }}
                  >
                    Ver todos →
                  </button>
                </div>
                <div className="prod-grid">
                  {itens.slice(0, 8).map(p => (
                    <CardProduto key={`${cat}-${p.id}`} p={p} slug={params.slug} cor={cor} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Depoimentos de clientes — só na vitrine (home) */}
      {modoVitrine && revendedora.mostrar_bloco_depoimentos !== false && <Depoimentos cor={cor} fontHead={fontHead} />}

      {/* Busca ou categoria selecionada: grid plano dos resultados. */}
      {!modoVitrine && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
          {produtos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              Nenhuma joia encontrada nesta busca.
            </div>
          ) : (
            <>
              {/* Barra superior: contagem + dropdown de ordenação */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 20,
                flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                  <strong style={{ color: '#1D1D1D' }}>{produtos.length}</strong> {produtos.length === 1 ? 'peça' : 'peças'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="ordenar" style={{ fontSize: 12, color: '#777', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    Ordenar por:
                  </label>
                  <select
                    id="ordenar"
                    value={ordenacao}
                    onChange={e => setOrdenacao(e.target.value as Ordenacao)}
                    style={{
                      background: '#fff',
                      border: '1px solid #DDD',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1D1D1D',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      minWidth: 140,
                    }}
                  >
                    <option value="relevante">⭐ Mais relevantes</option>
                    <option value="menor_preco">💰 Menor preço</option>
                    <option value="maior_preco">💎 Maior preço</option>
                    <option value="nome_az">🔤 Nome (A-Z)</option>
                  </select>
                </div>
              </div>
              <div className="prod-grid">
                {[...produtos].sort((a, b) => {
                  const precoA = a.preco_promo ?? a.preco
                  const precoB = b.preco_promo ?? b.preco
                  if (ordenacao === 'menor_preco') return precoA - precoB
                  if (ordenacao === 'maior_preco') return precoB - precoA
                  if (ordenacao === 'nome_az') return a.nome.localeCompare(b.nome, 'pt-BR')
                  return 0 // relevante = ordem original da API
                }).map(p => (
                  <CardProduto key={p.id} p={p} slug={params.slug} cor={cor} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Garantias — sempre aparece (vitrine e filtro), antes do footer */}
      <FormasPagamento fontHead={fontHead} />

      {revendedora.mostrar_bloco_garantias !== false && <GarantiasRow cor={cor} />}

      <footer style={{ background: '#1D1D1D', color: 'white', padding: '48px 24px', marginTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: fontHead, fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>
            {nomeLoja}
          </div>
          <div style={{ fontSize: 12, color: '#999', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24 }}>
            Joias 925
          </div>

          <div style={{ display: 'inline-block', padding: '20px 32px', border: '1px solid #333', borderRadius: 16, marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
              Selo de qualidade
            </div>
            <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 32, fontWeight: 700, color: 'white', letterSpacing: 2 }}>
              925
            </div>
            <div style={{ fontSize: 10, color: '#777', marginTop: 4 }}>
              Prata legítima certificada
            </div>
          </div>

          <div style={{ fontSize: 13, color: '#999', lineHeight: 1.8, marginBottom: 16 }}>
            Envio para todo o Brasil<br/>
            Prata 925 legítima certificada
          </div>

          {temRedes && (
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              {linkInstagram && (
                <a
                  href={linkInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  style={{ width: 42, height: 42, borderRadius: '50%', background: '#222', border: '1px solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              )}
              {linkTiktok && (
                <a
                  href={linkTiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  style={{ width: 42, height: 42, borderRadius: '50%', background: '#222', border: '1px solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                </a>
              )}
            </div>
          )}

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #333', fontSize: 11, color: '#666' }}>
            © Prata 925 · {new Date().getFullYear()}
          </div>
        </div>
      </footer>

      {/* Botão flutuante WhatsApp da revendedora — sempre visível enquanto
          a vitrine estiver aberta. Esquerda pra não bater com o carrinho. */}
      {linkWhatsApp && (
        <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" className="lj-wa" aria-label={`Falar com ${revendedora.nome.split(' ')[0]} no WhatsApp`}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.738-.981a9.86 9.86 0 0 0 .24.374zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
        </a>
      )}
    </div>
  )
}