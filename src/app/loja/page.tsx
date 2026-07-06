'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

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
  lancamento: boolean
  tamanho: string | null
  cor: string | null
}

type Revendedora = {
  id: string
  nome: string
  nome_loja: string | null
  whatsapp: string
  cidade: string
  estado: string
  foto_url: string | null
  bio: string | null
  status: string
  subdominio: string
}

export default function LojaPage({ params }: { params: { slug: string } }) {
  const [revendedora, setRevendedora] = useState<Revendedora | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaAtiva, setCategoriaAtiva] = useState('Tudo')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function carregarRevendedora() {
      try {
        const res = await fetch(`/api/loja/${params.slug}`)
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        setRevendedora(data)
      } catch (e) {
        console.error('Erro ao carregar revendedora:', e)
      }
    }
    carregarRevendedora()
  }, [params.slug])

  useEffect(() => {
    async function carregarProdutos() {
      try {
        const q = new URLSearchParams()
        if (categoriaAtiva !== 'Tudo') q.set('categoria', categoriaAtiva)
        if (busca) q.set('busca', busca)
        const res = await fetch(`/api/produtos?${q.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        setProdutos(data.produtos || [])
        if (categorias.length === 0) {
          setCategorias(['Tudo', ...(data.categorias || [])])
        }
      } catch (e) {
        console.error('Erro ao carregar produtos:', e)
      }
      setLoading(false)
    }
    carregarProdutos()
  }, [categoriaAtiva, busca])

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

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
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
            Loja não encontrada
          </h1>
          <p style={{ fontSize: 14, color: '#777', lineHeight: 1.6 }}>
            Esta loja pode estar inativa ou o link está incorreto.
          </p>
        </div>
      </div>
    )
  }

  const nomeLoja = revendedora.nome_loja || `Loja da ${revendedora.nome.split(' ')[0]}`
  const whatsappLimpo = revendedora.whatsapp.replace(/\D/g, '')

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: '-apple-system, "Inter", sans-serif' }}>

      <header style={{ background: 'white', borderBottom: '1px solid #EEE', padding: '20px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: revendedora.foto_url ? `url(${revendedora.foto_url}) center/cover` : '#1A1A1A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 18,
            }}>
              {!revendedora.foto_url && revendedora.nome[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', letterSpacing: -0.3, lineHeight: 1.1 }}>
                {nomeLoja}
              </div>
              <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2, fontWeight: 500 }}>
                Joias 925 · {revendedora.cidade}/{revendedora.estado}
              </div>
            </div>
          </div>

          <a
            href={`https://wa.me/55${whatsappLimpo}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 24,
              background: '#1A1A1A', color: 'white',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Atendimento
          </a>
        </div>
      </header>

      <section style={{ padding: '60px 24px 40px', textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#999', fontWeight: 600, marginBottom: 16 }}>
          Prata 925 Legítima
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#1A1A1A', letterSpacing: -1, lineHeight: 1.15, marginBottom: 16 }}>
          Joias que contam<br/>
          <em style={{ fontStyle: 'italic', color: '#555' }}>histórias suas</em>
        </h1>
        <p style={{ fontSize: 15, color: '#777', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
          {revendedora.bio || `Curadoria especial de peças em prata 925, escolhidas com carinho por ${revendedora.nome.split(' ')[0]} para você.`}
        </p>
      </section>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px' }}>
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Buscar joia..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: '100%', padding: '14px 18px',
              border: '1px solid #EEE', borderRadius: 12,
              fontSize: 14, background: 'white',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              style={{
                padding: '8px 18px', borderRadius: 24,
                border: '1px solid',
                borderColor: categoriaAtiva === cat ? '#1A1A1A' : '#EEE',
                background: categoriaAtiva === cat ? '#1A1A1A' : 'white',
                color: categoriaAtiva === cat ? 'white' : '#555',
                fontSize: 13, fontWeight: 500,
                whiteSpace: 'nowrap', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
        {produtos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            Nenhuma joia encontrada nesta busca.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
            {produtos.map(p => {
              const precoFinal = p.preco
              const temDesconto = false
              const fotoPrincipal = (p.fotos && p.fotos.length > 0) ? p.fotos[0] : ''

              return (
                <Link
                  key={p.id}
                  href={`/loja/${params.slug}/produto/${p.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #EEE', transition: 'all .2s' }}>
                    <div style={{ position: 'relative', paddingTop: '100%', background: '#F5F5F5', overflow: 'hidden' }}>
                      {fotoPrincipal && (
                        <img src={fotoPrincipal} alt={p.nome} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
                      )}
                      {p.destaque && (
                        <div style={{ position: 'absolute', top: 12, left: 12, background: '#1A1A1A', color: 'white', fontSize: 10, padding: '4px 10px', borderRadius: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                          Destaque
                        </div>
                      )}
                      {temDesconto && (
                        <div style={{ position: 'absolute', top: 12, right: 12, background: '#DC2626', color: 'white', fontSize: 10, padding: '4px 10px', borderRadius: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                          Promo
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 10, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                        {p.categoria}
                      </div>
                      <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 15, color: '#1A1A1A', marginBottom: 8, lineHeight: 1.3, fontWeight: 600, minHeight: 40 }}>
                        {p.nome}
                      </div>
                      {temDesconto ? (
                        <>
                          <div style={{ fontSize: 12, color: '#999', textDecoration: 'line-through', marginBottom: 2 }}>
                            {formatBRL(p.preco)}
                          </div>
                          <div style={{ fontSize: 18, color: '#DC2626', fontWeight: 700 }}>
                            {formatBRL(precoFinal)}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 18, color: '#1A1A1A', fontWeight: 700 }}>
                          {formatBRL(precoFinal)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                        ou 6x de {formatBRL(precoFinal / 6)} sem juros
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <footer style={{ background: '#1A1A1A', color: 'white', padding: '48px 24px', marginTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 }}>
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
            Atendimento personalizado via WhatsApp<br/>
            Envio para todo o Brasil
          </div>

          <a
            href={`https://wa.me/55${whatsappLimpo}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 24, background: 'white', color: '#1A1A1A', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            Chamar no WhatsApp
          </a>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #333', fontSize: 11, color: '#666' }}>
            © Prata 925 · {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  )
}