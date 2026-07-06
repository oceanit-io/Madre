'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Pedido = {
  id: string
  numero_pedido: string
  cliente_nome: string
  cliente_email: string
  status: string
  slug_revendedora: string
  subtotal: number
  frete: number
  total: number
  comissao_rev: number
  codigo_rastreio: string | null
  created_at: string
}

type PorRev = { slug: string; vendas: number; faturamento: number; comissao: number }

type Totais = {
  pedidos: number
  faturamento_total: number
  subtotal_total: number
  frete_total: number
  comissao_total_revs: number
}

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  pago: { bg: '#DCFCE7', color: '#15803D', label: 'Pago' },
  enviado: { bg: '#DBEAFE', color: '#1E40AF', label: 'Enviado' },
  entregue: { bg: '#E0E7FF', color: '#3730A3', label: 'Entregue' },
}

export default function AdminVendasPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [porRev, setPorRev] = useState<PorRev[]>([])
  const [totais, setTotais] = useState<Totais | null>(null)
  const [filtroMes, setFiltroMes] = useState(mesAtual())
  const [filtroSlug, setFiltroSlug] = useState('')
  const [loading, setLoading] = useState(true)
  // Edição de rastreio inline: pedidoId → valor atual no input
  const [rastreioEdit, setRastreioEdit] = useState<Record<string, string>>({})
  const [salvandoRastreio, setSalvandoRastreio] = useState<string | null>(null)
  const [rastreioSalvo, setRastreioSalvo] = useState<string | null>(null)
  // Card expandido (mostra o editor de rastreio)
  const [expandido, setExpandido] = useState<string | null>(null)

  async function salvarRastreio(pedidoId: string, codigo: string) {
    setSalvandoRastreio(pedidoId)
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ codigo_rastreio: codigo.trim() }),
      })
      if (res.ok) {
        const codFinal = codigo.trim() || null
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, codigo_rastreio: codFinal } : p))
        setRastreioSalvo(pedidoId)
        setTimeout(() => setRastreioSalvo(null), 2500)
      }
    } catch { /* */ }
    setSalvandoRastreio(null)
  }

  useEffect(() => {
    const a = sessionStorage.getItem('admin_auth')
    if (a === 'ok') setAutenticado(true)
    else router.replace('/admin')
    setChecandoAuth(false)
  }, [router])

  const authHeaders = useMemo(() => ({}), [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filtroMes) p.set('mes', filtroMes)
      if (filtroSlug) p.set('slug', filtroSlug)
      const res = await fetch(`/api/admin/vendas?${p.toString()}`, { headers: authHeaders, cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const d = await res.json()
      setPedidos(d.pedidos || [])
      setPorRev(d.por_revendedora || [])
      setTotais(d.totais || null)
    } catch { /* */ }
    setLoading(false)
  }, [authHeaders, filtroMes, filtroSlug])

  useEffect(() => { if (autenticado) carregar() }, [autenticado, carregar])

  if (checandoAuth || !autenticado) {
    return <div style={center}><div style={loadingTxt}>Carregando…</div></div>
  }

  return (
    <div className="vn-wrap">
      <header className="vn-top">
        <div className="vn-in">
          <div className="vn-brand">
            <div className="vn-mark">925</div>
            <div>
              <div className="vn-title">Vendas · Prata 925</div>
              <div className="vn-sub">{totais?.pedidos || 0} pedidos · {fmtBRL(totais?.faturamento_total || 0)}</div>
            </div>
          </div>
          <div className="vn-actions">
            <Link href="/admin/pedidos" className="vn-ghost">📦 Pedidos</Link>
            <Link href="/admin" className="vn-ghost">← Admin</Link>
            <button onClick={() => { sessionStorage.clear(); router.replace('/admin') }} className="vn-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="vn-body">
        {/* Filtros */}
        <div className="vn-filtros">
          <div className="vn-fld">
            <label>Mês</label>
            <input
              type="month"
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="vn-input"
            />
          </div>
          <div className="vn-fld">
            <label>Revendedora (slug)</label>
            <input
              type="text"
              value={filtroSlug}
              onChange={e => setFiltroSlug(e.target.value)}
              placeholder="ex: gabrielafernandez-5034"
              className="vn-input"
            />
          </div>
          <button onClick={() => { setFiltroMes(''); setFiltroSlug('') }} className="vn-ghost" type="button">Limpar</button>
        </div>

        {/* Totais */}
        {totais && (
          <div className="vn-resumo">
            <div className="vn-stat">
              <div className="vn-stat-label">Faturamento total</div>
              <div className="vn-stat-val">{fmtBRL(totais.faturamento_total)}</div>
            </div>
            <div className="vn-stat">
              <div className="vn-stat-label">Subtotal (sem frete)</div>
              <div className="vn-stat-val">{fmtBRL(totais.subtotal_total)}</div>
            </div>
            <div className="vn-stat">
              <div className="vn-stat-label">Frete arrecadado</div>
              <div className="vn-stat-val">{fmtBRL(totais.frete_total)}</div>
            </div>
            <div className="vn-stat">
              <div className="vn-stat-label">Comissão revendedoras</div>
              <div className="vn-stat-val">{fmtBRL(totais.comissao_total_revs)}</div>
            </div>
          </div>
        )}

        {/* Por revendedora */}
        {porRev.length > 0 && (
          <>
            <h3 className="vn-h">Por revendedora</h3>
            <div className="vn-rev-list">
              {porRev.map(r => (
                <button
                  key={r.slug}
                  onClick={() => setFiltroSlug(r.slug === filtroSlug ? '' : r.slug)}
                  className="vn-rev-card"
                  style={{ borderColor: filtroSlug === r.slug ? '#1a1a1a' : '#eee' }}
                >
                  <div className="vn-rev-slug">{r.slug}</div>
                  <div className="vn-rev-stats">
                    <span><strong>{r.vendas}</strong> vendas</span>
                    <span><strong>{fmtBRL(r.faturamento)}</strong> faturado</span>
                    <span><strong>{fmtBRL(r.comissao)}</strong> comissão</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Pedidos */}
        <h3 className="vn-h">Pedidos {filtroSlug ? `de ${filtroSlug}` : ''}</h3>
        {loading ? (
          <div className="vn-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : pedidos.length === 0 ? (
          <div className="vn-empty">Nenhum pedido pago no período.</div>
        ) : (
          <div className="vn-pedidos">
            {pedidos.map(p => {
              const meta = STATUS_META[p.status] || { bg: '#f5f5f5', color: '#64748b', label: p.status }
              const aberto = expandido === p.id
              const rastreioAtual = p.codigo_rastreio || ''
              const valorEdit = rastreioEdit[p.id] !== undefined ? rastreioEdit[p.id] : rastreioAtual
              const salvando = salvandoRastreio === p.id
              const recemSalvo = rastreioSalvo === p.id
              return (
                <div key={p.id} className="vn-ped">
                  <button
                    type="button"
                    onClick={() => setExpandido(aberto ? null : p.id)}
                    className="vn-ped-head"
                  >
                    <div className="vn-ped-info">
                      <div className="vn-ped-num">
                        {p.numero_pedido}
                        {p.codigo_rastreio && <span className="vn-ped-rast-pill">📦 rastreio</span>}
                      </div>
                      <div className="vn-ped-meta">
                        {p.cliente_nome} · {p.slug_revendedora} · {fmtData(p.created_at)}
                      </div>
                    </div>
                    <div className="vn-ped-right">
                      <div className="vn-ped-val">{fmtBRL(p.total)}</div>
                      <div className="vn-ped-comissao">comissão {fmtBRL(p.comissao_rev)}</div>
                      <span className="vn-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </div>
                  </button>

                  {aberto && (
                    <div className="vn-ped-body">
                      <div className="vn-ped-rast-block">
                        <label className="vn-ped-rast-label">📦 Código de rastreio Correios</label>
                        <div className="vn-ped-rast-row">
                          <input
                            type="text"
                            value={valorEdit}
                            onChange={e => setRastreioEdit(prev => ({ ...prev, [p.id]: e.target.value.toUpperCase() }))}
                            placeholder="Ex: BR123456789BR"
                            maxLength={50}
                            disabled={salvando}
                            className="vn-ped-rast-input"
                          />
                          <button
                            type="button"
                            onClick={() => salvarRastreio(p.id, valorEdit)}
                            disabled={salvando || valorEdit === rastreioAtual}
                            className="vn-ped-rast-btn"
                          >
                            {salvando ? 'Salvando…' : recemSalvo ? '✓ Salvo!' : 'Salvar'}
                          </button>
                        </div>
                        {p.codigo_rastreio && (
                          <a
                            href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(p.codigo_rastreio)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="vn-ped-rast-link"
                          >
                            🔍 Rastrear no site dos Correios →
                          </a>
                        )}
                      </div>
                      <div className="vn-ped-acoes">
                        <Link
                          href={`/admin/pedidos/${p.id}/imprimir`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="vn-ped-print"
                        >
                          🖨️ Imprimir pedido
                        </Link>
                        <Link href={`/admin/pedidos`} className="vn-ped-acao">
                          Ver detalhes / mudar status →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .vn-wrap { min-height: 100vh; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; color: #1a1a1a; }
        .vn-top { position: sticky; top: 0; z-index: 50; background: #fff; border-bottom: 1px solid #eee; }
        .vn-in { max-width: 1100px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .vn-brand { display: flex; align-items: center; gap: 12px; }
        .vn-mark { width: 38px; height: 38px; border-radius: 10px; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
        .vn-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 700; }
        .vn-sub { font-size: 12px; color: #94a3b8; }
        .vn-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .vn-ghost { padding: 8px 14px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; font-size: 13px; cursor: pointer; color: #555; text-decoration: none; font-family: inherit; }
        .vn-ghost:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .vn-body { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .vn-filtros { display: flex; gap: 12px; align-items: end; margin-bottom: 24px; flex-wrap: wrap; }
        .vn-fld { display: flex; flex-direction: column; gap: 4px; min-width: 140px; flex: 1; }
        .vn-fld label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
        .vn-input { padding: 10px 12px; border: 1px solid #eee; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; }
        .vn-resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 28px; }
        .vn-stat { padding: 14px 16px; border: 1px solid #eee; border-radius: 12px; background: #fff; }
        .vn-stat-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .vn-stat-val { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; color: #1a1a1a; }
        .vn-h { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin: 8px 0 12px; }
        .vn-rev-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 28px; }
        .vn-rev-card { background: #fff; border: 2px solid #eee; border-radius: 12px; padding: 12px 14px; cursor: pointer; text-align: left; font-family: inherit; transition: all .15s; }
        .vn-rev-card:hover { border-color: #1a1a1a; }
        .vn-rev-slug { font-family: monospace; font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .vn-rev-stats { display: flex; gap: 16px; font-size: 12px; color: #64748b; flex-wrap: wrap; }
        .vn-pedidos { display: flex; flex-direction: column; gap: 10px; }
        .vn-ped { background: #fff; border: 1px solid #eee; border-radius: 12px; overflow: hidden; transition: border-color .15s; }
        .vn-ped:hover { border-color: #cbd5e1; }
        .vn-ped-head { width: 100%; background: transparent; border: 0; padding: 12px 14px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; text-align: left; cursor: pointer; font-family: inherit; color: inherit; }
        .vn-ped-info { min-width: 200px; flex: 1; }
        .vn-ped-num { font-family: monospace; font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .vn-ped-rast-pill { font-family: 'Inter', system-ui, sans-serif; font-size: 10px; font-weight: 700; padding: 2px 8px; background: #DBEAFE; color: #1E40AF; border-radius: 999px; }
        .vn-ped-meta { font-size: 11px; color: #64748b; }
        .vn-ped-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .vn-ped-val { font-size: 16px; font-weight: 700; color: #1a1a1a; font-family: 'Playfair Display', Georgia, serif; }
        .vn-ped-comissao { font-size: 11px; color: #64748b; }
        .vn-badge { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
        .vn-ped-body { padding: 0 14px 14px; border-top: 1px solid #f1f5f9; padding-top: 14px; display: flex; flex-direction: column; gap: 12px; }
        .vn-ped-rast-block { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 12px 14px; }
        .vn-ped-rast-label { display: block; font-size: 11px; font-weight: 700; color: #1E40AF; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
        .vn-ped-rast-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .vn-ped-rast-input { flex: 1; min-width: 180px; padding: 9px 12px; border: 1px solid #BFDBFE; border-radius: 8px; font-family: monospace; font-size: 13px; background: #fff; outline: none; }
        .vn-ped-rast-input:focus { border-color: #1E40AF; }
        .vn-ped-rast-btn { padding: 9px 16px; background: #1E40AF; color: #fff; border: 0; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
        .vn-ped-rast-btn:disabled { opacity: .55; cursor: not-allowed; }
        .vn-ped-rast-link { display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 600; color: #1E40AF; text-decoration: none; }
        .vn-ped-rast-link:hover { text-decoration: underline; }
        .vn-ped-acoes { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .vn-ped-acao { font-size: 12px; color: #64748b; text-decoration: none; font-weight: 600; }
        .vn-ped-acao:hover { color: #1a1a1a; }
        .vn-ped-print { background: #0F172A; color: #fff; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none; }
        .vn-ped-print:hover { background: #1E293B; }
        .vn-empty { padding: 60px 20px; text-align: center; color: #94a3b8; font-size: 14px; }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
