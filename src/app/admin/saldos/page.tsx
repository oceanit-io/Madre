'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Linha = {
  id: string
  nome: string
  nome_loja: string | null
  subdominio: string
  status: string
  kyc_status: string
  saldo_disponivel: number
  saldo_processando: number
  total_ganho: number
  total_vendas: number
  total_sacado: number
  em_saque: number
}

type Agregados = {
  total_disponivel: number
  total_processando: number
  total_em_saque: number
  total_ja_sacado: number
  total_revendedoras: number
}

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AdminSaldosPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [revs, setRevs] = useState<Linha[]>([])
  const [agregados, setAgregados] = useState<Agregados | null>(null)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

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
      const res = await fetch('/api/admin/saldos', { headers: authHeaders, cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const d = await res.json()
      setRevs(d.revendedoras || [])
      setAgregados(d.agregados || null)
    } catch { /* */ }
    setLoading(false)
  }, [authHeaders])

  useEffect(() => { if (autenticado) carregar() }, [autenticado, carregar])

  const filtrados = useMemo(() => {
    const t = busca.toLowerCase().trim()
    if (!t) return revs
    return revs.filter(r =>
      r.nome.toLowerCase().includes(t) ||
      r.subdominio.toLowerCase().includes(t) ||
      (r.nome_loja || '').toLowerCase().includes(t)
    )
  }, [revs, busca])

  if (checandoAuth || !autenticado) {
    return <div style={center}><div style={loadingTxt}>Carregando…</div></div>
  }

  return (
    <div className="sl-wrap">
      <header className="sl-top">
        <div className="sl-in">
          <div className="sl-brand">
            <div className="sl-mark">925</div>
            <div>
              <div className="sl-title">Saldos · Prata 925</div>
              <div className="sl-sub">{agregados?.total_revendedoras || 0} revendedoras</div>
            </div>
          </div>
          <div className="sl-actions">
            <Link href="/admin/saques" className="sl-ghost">💸 Saques</Link>
            <Link href="/admin" className="sl-ghost">← Admin</Link>
            <button onClick={() => { sessionStorage.clear(); router.replace('/admin') }} className="sl-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="sl-body">
        {/* Agregados */}
        {agregados && (
          <div className="sl-resumo">
            <div className="sl-stat" style={{ borderColor: '#15803D' }}>
              <div className="sl-stat-label" style={{ color: '#15803D' }}>Disponível pra saque</div>
              <div className="sl-stat-val">{fmtBRL(agregados.total_disponivel)}</div>
            </div>
            <div className="sl-stat" style={{ borderColor: '#92400E' }}>
              <div className="sl-stat-label" style={{ color: '#92400E' }}>Em carência (20d)</div>
              <div className="sl-stat-val">{fmtBRL(agregados.total_processando)}</div>
            </div>
            <div className="sl-stat" style={{ borderColor: '#1E40AF' }}>
              <div className="sl-stat-label" style={{ color: '#1E40AF' }}>Em saque (pendente)</div>
              <div className="sl-stat-val">{fmtBRL(agregados.total_em_saque)}</div>
            </div>
            <div className="sl-stat" style={{ borderColor: '#64748B' }}>
              <div className="sl-stat-label" style={{ color: '#64748B' }}>Já sacado (histórico)</div>
              <div className="sl-stat-val">{fmtBRL(agregados.total_ja_sacado)}</div>
            </div>
          </div>
        )}

        <input
          className="sl-input"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou subdomínio…"
        />

        {loading ? (
          <div className="sl-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : filtrados.length === 0 ? (
          <div className="sl-empty">Nenhuma revendedora.</div>
        ) : (
          <div className="sl-list">
            {filtrados.map(r => (
              <div key={r.id} className="sl-card">
                <div className="sl-info">
                  <div className="sl-nome">{r.nome_loja || r.nome}</div>
                  <div className="sl-meta">
                    {r.subdominio} · status {r.status} · KYC <strong>{r.kyc_status}</strong>
                  </div>
                </div>
                <div className="sl-numbers">
                  <div className="sl-num">
                    <span className="sl-num-label">Disponível</span>
                    <span className="sl-num-val" style={{ color: r.saldo_disponivel > 0 ? '#15803D' : '#9ca3af' }}>
                      {fmtBRL(r.saldo_disponivel)}
                    </span>
                  </div>
                  <div className="sl-num">
                    <span className="sl-num-label">Processando</span>
                    <span className="sl-num-val">{fmtBRL(r.saldo_processando)}</span>
                  </div>
                  <div className="sl-num">
                    <span className="sl-num-label">Em saque</span>
                    <span className="sl-num-val">{fmtBRL(r.em_saque)}</span>
                  </div>
                  <div className="sl-num">
                    <span className="sl-num-label">Já sacado</span>
                    <span className="sl-num-val">{fmtBRL(r.total_sacado)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .sl-wrap { min-height: 100vh; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; color: #1a1a1a; }
        .sl-top { position: sticky; top: 0; z-index: 50; background: #fff; border-bottom: 1px solid #eee; }
        .sl-in { max-width: 1100px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .sl-brand { display: flex; align-items: center; gap: 12px; }
        .sl-mark { width: 38px; height: 38px; border-radius: 10px; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
        .sl-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 700; }
        .sl-sub { font-size: 12px; color: #94a3b8; }
        .sl-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .sl-ghost { padding: 8px 14px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; font-size: 13px; cursor: pointer; color: #555; text-decoration: none; font-family: inherit; }
        .sl-ghost:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .sl-body { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .sl-resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .sl-stat { padding: 16px 18px; border: 2px solid #eee; border-radius: 14px; background: #fff; }
        .sl-stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
        .sl-stat-val { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #1a1a1a; }
        .sl-input { width: 100%; padding: 11px 14px; border: 1px solid #eee; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 20px; }
        .sl-list { display: flex; flex-direction: column; gap: 12px; }
        .sl-card { background: #fff; border: 1px solid #eee; border-radius: 14px; padding: 16px 18px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .sl-info { min-width: 200px; flex: 1; }
        .sl-nome { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .sl-meta { font-size: 12px; color: #64748b; }
        .sl-numbers { display: grid; grid-template-columns: repeat(2, minmax(110px, 1fr)); gap: 10px; min-width: 240px; }
        .sl-num { display: flex; flex-direction: column; }
        .sl-num-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; }
        .sl-num-val { font-size: 14px; font-weight: 700; color: #1a1a1a; }
        .sl-empty { padding: 60px 20px; text-align: center; color: #94a3b8; font-size: 14px; }
        @media (min-width: 760px) {
          .sl-numbers { grid-template-columns: repeat(4, minmax(110px, 1fr)); }
        }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
