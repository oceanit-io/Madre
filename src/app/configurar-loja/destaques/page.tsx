'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/dashboard/BottomNav'
import BannerPagamentoPendente from '@/components/dashboard/BannerPagamentoPendente'

const MAX_DESTAQUES = 12

type Produto = {
  id: string
  sku: string | number
  nome: string
  preco: number
  preco_promo: number | null
  fotos: string[] | null
}

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DestaquesPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Produto[]>([])
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  function flash(msg: string, tipo: 'ok' | 'erro') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  const skusSelecionados = useMemo(
    () => new Set(selecionados.map(p => String(p.sku))),
    [selecionados]
  )

  // Carga inicial: SKUs salvos + catálogo (pra resolver os SKUs em produtos).
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: rev } = await supabase
        .from('revendedoras')
        .select('destaques_skus, status')
        .eq('user_id', user.id)
        .single()
      if (!rev) { router.push('/auth/login'); return }
      setStatus(rev.status)

      let catalogo: Produto[] = []
      try {
        const res = await fetch('/api/produtos')
        if (res.ok) catalogo = (await res.json()).produtos || []
      } catch { /* best-effort */ }
      setResultados(catalogo.slice(0, 24))

      const salvos: (string | number)[] = Array.isArray(rev.destaques_skus) ? rev.destaques_skus : []
      if (salvos.length > 0) {
        const porSku = new Map(catalogo.map(p => [String(p.sku), p]))
        setSelecionados(salvos.map(s => porSku.get(String(s))).filter((p): p is Produto => !!p))
      }
      setLoading(false)
    }
    load()
  }, [router])

  // Busca (debounce).
  useEffect(() => {
    const termo = busca.trim()
    if (!termo) return
    setBuscando(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/produtos?busca=${encodeURIComponent(termo)}`)
        if (res.ok) setResultados(((await res.json()).produtos || []).slice(0, 40))
      } catch { /* */ }
      setBuscando(false)
    }, 350)
    return () => clearTimeout(t)
  }, [busca])

  function toggle(p: Produto) {
    if (skusSelecionados.has(String(p.sku))) {
      setSelecionados(prev => prev.filter(x => String(x.sku) !== String(p.sku)))
    } else {
      if (selecionados.length >= MAX_DESTAQUES) {
        flash(`Máximo ${MAX_DESTAQUES} destaques`, 'erro')
        return
      }
      setSelecionados(prev => [...prev, p])
    }
  }

  async function salvar() {
    if (salvando) return
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token
      const res = await fetch('/api/revendedora/loja', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destaques_skus: selecionados.map(p => p.sku) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        flash(j?.erro || 'Erro ao salvar', 'erro')
      } else {
        flash('Destaques salvos ✓', 'ok')
      }
    } catch {
      flash('Erro de conexão', 'erro')
    }
    setSalvando(false)
  }

  const foto = (p: Produto) => (p.fotos && p.fotos.length > 0 ? p.fotos[0] : null)

  if (loading) return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--cinza)' }}>Carregando...</div>
    </div>
  )

  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 120 }}>
      <BannerPagamentoPendente status={status || undefined} />

      <header style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/configurar-loja')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)', display: 'flex', alignItems: 'center' }} aria-label="Voltar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)' }}>Destaques da loja</div>
      </header>

      <div style={{ padding: '18px 16px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--cinza)', lineHeight: 1.5, marginBottom: 16 }}>
          Escolha as peças que aparecem em <strong>Destaques</strong> na sua vitrine
          (até {MAX_DESTAQUES}). Se não escolher nenhuma, mostramos nossos destaques automáticos.
        </p>

        {/* Selecionados */}
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
          Seus destaques ({selecionados.length}/{MAX_DESTAQUES})
        </div>
        {selecionados.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--cinza)', fontSize: 13, marginBottom: 18 }}>
            Nenhum escolhido — mostrando os destaques padrão. Toque na ⭐ de uma peça pra adicionar.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 18 }}>
            {selecionados.map(p => (
              <div key={p.id} style={{ position: 'relative', flexShrink: 0, width: 88 }}>
                <div style={{ width: 88, height: 88, borderRadius: 12, overflow: 'hidden', background: 'var(--rosa-pale)' }}>
                  {foto(p) && <img src={foto(p)!} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <button onClick={() => toggle(p)} aria-label="Remover" style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%', background: '#C0392B', color: '#fff', border: '2px solid #fff', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                <div style={{ fontSize: 10, color: 'var(--cinza)', marginTop: 4, lineHeight: 1.2, maxHeight: 24, overflow: 'hidden' }}>{p.nome}</div>
              </div>
            ))}
          </div>
        )}

        {/* Busca */}
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar peça pra destacar… (ex: trevo, anel)"
          style={{ width: '100%', padding: '13px 16px', border: '1.5px solid var(--rosa-border)', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box', marginBottom: 14 }}
        />

        {/* Resultados */}
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
          {busca.trim() ? (buscando ? 'Buscando…' : 'Resultados') : 'Catálogo'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
          {resultados.map(p => {
            const sel = skusSelecionados.has(String(p.sku))
            return (
              <button key={p.id} onClick={() => toggle(p)} style={{ position: 'relative', textAlign: 'left', background: 'white', border: `2px solid ${sel ? 'var(--rosa)' : 'var(--rosa-border)'}`, borderRadius: 12, padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ width: '100%', aspectRatio: '1', background: 'var(--rosa-pale)' }}>
                  {foto(p) && <img src={foto(p)!} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: sel ? 'var(--rosa)' : 'rgba(255,255,255,.9)', color: sel ? '#fff' : '#bbb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>★</div>
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: 'var(--texto)', lineHeight: 1.2, maxHeight: 24, overflow: 'hidden' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto)', marginTop: 2 }}>{formatBRL(p.preco_promo ?? p.preco)}</div>
                </div>
              </button>
            )
          })}
        </div>
        {resultados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--cinza)', fontSize: 13 }}>Nenhuma peça encontrada.</div>
        )}
      </div>

      {/* Salvar fixo */}
      <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, padding: '10px 16px', background: 'linear-gradient(to top, var(--off) 70%, transparent)', display: 'flex', justifyContent: 'center', zIndex: 90 }}>
        <button onClick={salvar} disabled={salvando} style={{ maxWidth: 430, width: '100%', padding: '15px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--rosa)', color: '#fff', fontFamily: 'Montserrat', fontSize: 15, fontWeight: 700, opacity: salvando ? .6 : 1, boxShadow: '0 4px 14px rgba(232,57,106,.3)' }}>
          {salvando ? 'Salvando…' : 'Salvar destaques'}
        </button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: toast.tipo === 'ok' ? '#065F46' : '#991B1B', color: '#fff', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>
          {toast.msg}
        </div>
      )}

      <BottomNav ativa="loja" />
    </div>
  )
}
