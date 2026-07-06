'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Produto = {
  id: string
  sku: string
  nome: string
  categoria: string | null
  preco: number
  fotos: string[] | null
  estoque: number
  destaque: boolean
}

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PER_PAGE = 24

export default function AdminDestaquesPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [busca, setBusca] = useState('')
  const [buscaDeb, setBuscaDeb] = useState('')
  const [soDestaque, setSoDestaque] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function mostrarToast(msg: string, tipo: 'ok' | 'erro') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tipo })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'ok') setAutenticado(true)
    else router.replace('/admin')
    setChecandoAuth(false)
  }, [router])

  function logout() {
    try { sessionStorage.removeItem('admin_auth'); sessionStorage.clear() } catch {}
    router.replace('/admin')
  }

  const authHeaders = useMemo(() => ({}), [])

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => { setPage(1) }, [buscaDeb, soDestaque])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (buscaDeb.trim()) p.set('busca', buscaDeb.trim())
      if (soDestaque) p.set('destaque', '1')
      p.set('page', String(page))
      p.set('per_page', String(PER_PAGE))
      const res = await fetch(`/api/admin/produtos?${p.toString()}`, {
        headers: authHeaders,
        cache: 'no-store',
      })
      if (!res.ok) { mostrarToast('Erro ao carregar', 'erro'); setLoading(false); return }
      const d = await res.json()
      setProdutos(d.produtos || [])
      setTotal(d.total || 0)
      setTotalPages(d.total_pages || 1)
    } catch { mostrarToast('Erro de conexão', 'erro') }
    setLoading(false)
  }, [authHeaders, buscaDeb, soDestaque, page])

  useEffect(() => {
    if (!autenticado) return
    carregar()
  }, [autenticado, carregar])

  async function toggle(prod: Produto) {
    if (savingId) return
    const novo = !prod.destaque
    setSavingId(prod.id)
    // otimista
    setProdutos(ps => ps.map(p => (p.id === prod.id ? { ...p, destaque: novo } : p)))
    try {
      const res = await fetch(`/api/admin/produtos/${prod.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destaque: novo }),
      })
      if (!res.ok) throw new Error()
      mostrarToast(novo ? 'Destacada ✨' : 'Removida dos destaques', 'ok')
    } catch {
      setProdutos(ps => ps.map(p => (p.id === prod.id ? { ...p, destaque: !novo } : p)))
      mostrarToast('Não foi possível salvar', 'erro')
    }
    setSavingId(null)
  }

  const [trayBusy, setTrayBusy] = useState(false)
  async function syncTray(dry: boolean) {
    if (trayBusy) return
    if (!dry && !confirm('Sincronizar TODO o catálogo da Tray para o Supabase agora? (atualiza/insere por SKU; preserva os destaques)')) return
    setTrayBusy(true)
    mostrarToast(dry ? 'Gerando prévia da Tray…' : 'Sincronizando com a Tray…', 'ok')
    try {
      const res = await fetch(`/api/cron/tray-sync${dry ? '?dry=1' : ''}`, {
        headers: authHeaders,
        cache: 'no-store',
      })
      const d = await res.json()
      if (!res.ok) { mostrarToast(d?.erro || 'Erro no sync', 'erro'); setTrayBusy(false); return }
      if (d.dry) {
        mostrarToast(`Prévia: ${d.total} produtos · ${d.categorias} categorias. Amostra no console.`, 'ok')
        console.log('[Tray dry-run] amostra:', d.amostra)
      } else {
        mostrarToast(`Sync OK: ${d.upserted} produtos · ${d.categorias} categorias · ${d.erros} erros`, 'ok')
        await carregar()
      }
    } catch { mostrarToast('Erro de conexão', 'erro') }
    setTrayBusy(false)
  }

  if (checandoAuth || !autenticado) {
    return (
      <div style={center}><div style={loadingTxt}>Carregando…</div></div>
    )
  }

  return (
    <div className="dq-wrap">
      <header className="dq-top">
        <div className="dq-top-in">
          <div className="dq-brand">
            <div className="dq-mark">925</div>
            <div>
              <div className="dq-title">Destaques · Prata 925</div>
              <div className="dq-sub">{total} produtos · marque as peças mais lindas</div>
            </div>
          </div>
          <div className="dq-actions">
            <button onClick={() => syncTray(true)} disabled={trayBusy} className="dq-ghost" type="button">Tray: prévia</button>
            <button onClick={() => syncTray(false)} disabled={trayBusy} className="dq-ghost" type="button" style={{ borderColor: '#1A1A1A', color: '#1A1A1A', fontWeight: 700 }}>🔄 Sincronizar Tray</button>
            <Link href="/admin/pedidos" className="dq-ghost">Pedidos</Link>
            <Link href="/admin" className="dq-ghost">← Admin</Link>
            <button onClick={logout} className="dq-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="dq-body">
        <div className="dq-filtros">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou SKU…"
            className="dq-input"
          />
          <button
            type="button"
            className="dq-chip"
            onClick={() => setSoDestaque(false)}
            style={!soDestaque ? { background: '#1A1A1A', color: '#fff', borderColor: '#1A1A1A' } : {}}
          >Todos</button>
          <button
            type="button"
            className="dq-chip"
            onClick={() => setSoDestaque(true)}
            style={soDestaque ? { background: '#1A1A1A', color: '#fff', borderColor: '#1A1A1A' } : {}}
          >Só destaques</button>
        </div>

        {loading ? (
          <div className="dq-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : produtos.length === 0 ? (
          <div className="dq-empty">Nenhum produto encontrado.</div>
        ) : (
          <div className="dq-grid">
            {produtos.map(p => {
              const foto = p.fotos && p.fotos.length > 0 ? p.fotos[0] : ''
              return (
                <div key={p.id} className="dq-card" style={p.destaque ? { borderColor: '#1A1A1A' } : {}}>
                  <div className="dq-foto">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt={p.nome} loading="lazy" />
                    ) : (
                      <div className="dq-foto-vazia">💎</div>
                    )}
                    {p.destaque && <div className="dq-flag">★ Destaque</div>}
                  </div>
                  <div className="dq-info">
                    <div className="dq-nome">{p.nome}</div>
                    <div className="dq-meta">
                      SKU {p.sku} · {formatBRL(p.preco)} · estoque {p.estoque}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={savingId === p.id}
                    className="dq-btn"
                    style={p.destaque
                      ? { background: '#1A1A1A', color: '#fff' }
                      : { background: '#fff', color: '#1A1A1A', border: '1px solid #1A1A1A' }}
                  >
                    {savingId === p.id ? '…' : p.destaque ? '★ Destacada' : '☆ Destacar'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {!loading && produtos.length > 0 && (
          <div className="dq-pag">
            <button className="dq-ghost" type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</button>
            <span style={{ fontSize: 13, color: '#64748B' }}>Página {page} de {totalPages}</span>
            <button className="dq-ghost" type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima →</button>
          </div>
        )}
      </div>

      {toast && (
        <div className="dq-toast" style={{ background: toast.tipo === 'ok' ? '#065F46' : '#991B1B' }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .dq-wrap { min-height: 100vh; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; color: #1a1a1a; }
        .dq-top { position: sticky; top: 0; z-index: 50; background: #fff; border-bottom: 1px solid #eee; }
        .dq-top-in { max-width: 1200px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .dq-brand { display: flex; align-items: center; gap: 12px; }
        .dq-mark { width: 38px; height: 38px; border-radius: 10px; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
        .dq-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 700; }
        .dq-sub { font-size: 12px; color: #94a3b8; }
        .dq-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .dq-ghost { padding: 8px 14px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; font-size: 13px; cursor: pointer; color: #555; text-decoration: none; font-family: inherit; }
        .dq-ghost:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .dq-ghost:disabled { opacity: .45; cursor: not-allowed; }
        .dq-body { max-width: 1200px; margin: 0 auto; padding: 24px; }
        .dq-filtros { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
        .dq-input { flex: 1; min-width: 220px; padding: 10px 14px; border: 1px solid #eee; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; }
        .dq-chip { padding: 9px 16px; border-radius: 999px; border: 1px solid #eee; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; color: #555; }
        .dq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .dq-card { background: #fff; border: 1px solid #eee; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
        .dq-foto { position: relative; aspect-ratio: 1; background: #f5f5f5; }
        .dq-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .dq-foto-vazia { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 38px; }
        .dq-flag { position: absolute; top: 10px; left: 10px; background: #1A1A1A; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
        .dq-info { padding: 12px 14px 8px; flex: 1; }
        .dq-nome { font-size: 13px; font-weight: 600; line-height: 1.35; margin-bottom: 4px; }
        .dq-meta { font-size: 11px; color: #94a3b8; }
        .dq-btn { margin: 0 14px 14px; padding: 10px; border-radius: 12px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .dq-btn:disabled { opacity: .6; cursor: wait; }
        .dq-empty { padding: 60px 20px; text-align: center; color: #94a3b8; font-size: 14px; }
        .dq-pag { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; }
        .dq-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 200; color: #fff; padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
        @media (max-width: 540px) {
          .dq-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .dq-top-in, .dq-body { padding-left: 14px; padding-right: 14px; }
        }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
