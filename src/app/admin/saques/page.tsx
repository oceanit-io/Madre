'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Saque = {
  id: string
  revendedora_id: string
  revendedora_nome: string
  revendedora_subdominio: string
  revendedora_whatsapp: string
  tipo: 'pix' | 'credito_loja'
  valor: number
  chave_pix: string | null
  status: 'solicitado' | 'processando' | 'pago' | 'recusado'
  criado_em: string
  pago_em: string | null
}

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  solicitado: { bg: '#FEF3C7', color: '#92400E', label: 'Solicitado' },
  processando: { bg: '#DBEAFE', color: '#1E40AF', label: 'Processando' },
  pago: { bg: '#DCFCE7', color: '#15803D', label: 'Pago' },
  recusado: { bg: '#FEE2E2', color: '#991B1B', label: 'Recusado' },
}

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminSaquesPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [saques, setSaques] = useState<Saque[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const tt = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flash(msg: string, tipo: 'ok' | 'erro') {
    if (tt.current) clearTimeout(tt.current)
    setToast({ msg, tipo })
    tt.current = setTimeout(() => setToast(null), 3000)
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
      if (filtroStatus !== 'todos') p.set('status', filtroStatus)
      const res = await fetch(`/api/admin/saques?${p.toString()}`, {
        headers: authHeaders, cache: 'no-store',
      })
      if (!res.ok) { flash('Erro ao carregar', 'erro'); setLoading(false); return }
      const d = await res.json()
      setSaques(d.saques || [])
    } catch { flash('Erro de conexão', 'erro') }
    setLoading(false)
  }, [authHeaders, filtroStatus])

  useEffect(() => {
    if (autenticado) carregar()
  }, [autenticado, carregar])

  async function acao(id: string, acao: 'processar' | 'pagar' | 'recusar', confirmar?: string) {
    if (savingId) return
    if (confirmar && !confirm(confirmar)) return
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/saques/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      })
      const d = await res.json()
      if (!res.ok) { flash(d?.erro || 'Erro', 'erro'); setSavingId(null); return }
      flash('Feito ✓', 'ok')
      await carregar()
    } catch { flash('Erro de conexão', 'erro') }
    setSavingId(null)
  }

  const agrupado = useMemo(() => {
    const total = saques.reduce((s, x) => s + x.valor, 0)
    const por = { solicitado: 0, processando: 0, pago: 0, recusado: 0 } as Record<string, number>
    for (const s of saques) por[s.status] = (por[s.status] || 0) + s.valor
    return { total, por }
  }, [saques])

  if (checandoAuth || !autenticado) {
    return <div style={center}><div style={loadingTxt}>Carregando…</div></div>
  }

  return (
    <div className="sq-wrap">
      <header className="sq-top">
        <div className="sq-in">
          <div className="sq-brand">
            <div className="sq-mark">925</div>
            <div>
              <div className="sq-title">Saques · Prata 925</div>
              <div className="sq-sub">{saques.length} saques · {fmtBRL(agrupado.total)} total</div>
            </div>
          </div>
          <div className="sq-actions">
            <Link href="/admin" className="sq-ghost">← Admin</Link>
            <button onClick={() => { sessionStorage.clear(); router.replace('/admin') }} className="sq-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="sq-body">
        {/* Resumo */}
        <div className="sq-resumo">
          {Object.entries(STATUS_META).map(([k, meta]) => (
            <button
              key={k}
              onClick={() => setFiltroStatus(filtroStatus === k ? 'todos' : k)}
              className="sq-stat"
              style={{
                borderColor: filtroStatus === k ? meta.color : '#eee',
                background: filtroStatus === k ? meta.bg : '#fff',
              }}
            >
              <div className="sq-stat-label" style={{ color: meta.color }}>{meta.label}</div>
              <div className="sq-stat-val">{fmtBRL(agrupado.por[k] || 0)}</div>
            </button>
          ))}
          <button
            onClick={() => setFiltroStatus('todos')}
            className="sq-stat"
            style={{
              borderColor: filtroStatus === 'todos' ? '#1a1a1a' : '#eee',
              background: filtroStatus === 'todos' ? '#f5f5f5' : '#fff',
            }}
          >
            <div className="sq-stat-label">Todos</div>
            <div className="sq-stat-val">{fmtBRL(agrupado.total)}</div>
          </button>
        </div>

        {loading ? (
          <div className="sq-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : saques.length === 0 ? (
          <div className="sq-empty">Nenhum saque {filtroStatus !== 'todos' ? `(${filtroStatus})` : ''}.</div>
        ) : (
          <div className="sq-list">
            {saques.map(s => {
              const meta = STATUS_META[s.status] || STATUS_META.solicitado
              const podeProcessar = s.status === 'solicitado'
              const podePagar = s.status === 'solicitado' || s.status === 'processando'
              const podeRecusar = s.status === 'solicitado' || s.status === 'processando'
              return (
                <div key={s.id} className="sq-card">
                  <div className="sq-info">
                    <div className="sq-nome">{s.revendedora_nome}</div>
                    <div className="sq-meta">
                      {s.revendedora_subdominio} · solicitado em {fmtData(s.criado_em)}
                    </div>
                    {s.tipo === 'pix' && s.chave_pix && (
                      <div className="sq-pix">
                        <span className="sq-pix-label">Chave PIX:</span>
                        <span className="sq-pix-key">{s.chave_pix}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(s.chave_pix || ''); flash('Chave copiada', 'ok') }}
                          className="sq-copy"
                          type="button"
                        >
                          📋
                        </button>
                      </div>
                    )}
                    {s.pago_em && (
                      <div className="sq-meta">Pago em {fmtData(s.pago_em)}</div>
                    )}
                  </div>
                  <div className="sq-right">
                    <div className="sq-valor">{fmtBRL(s.valor)}</div>
                    <span className="sq-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <div className="sq-btns">
                      {podeProcessar && (
                        <button disabled={savingId === s.id} onClick={() => acao(s.id, 'processar')} className="sq-b" style={{ background: '#1E40AF' }}>
                          ▶ Processando
                        </button>
                      )}
                      {podePagar && (
                        <button disabled={savingId === s.id} onClick={() => acao(s.id, 'pagar', `Marcar como PAGO o saque de ${fmtBRL(s.valor)} pra ${s.revendedora_nome}?`)} className="sq-b" style={{ background: '#065F46' }}>
                          ✓ Marcar pago
                        </button>
                      )}
                      {podeRecusar && (
                        <button disabled={savingId === s.id} onClick={() => acao(s.id, 'recusar', `Recusar este saque? O valor volta pro saldo da revendedora.`)} className="sq-b" style={{ background: '#991B1B' }}>
                          ✕ Recusar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="sq-toast" style={{ background: toast.tipo === 'ok' ? '#065F46' : '#991B1B' }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .sq-wrap { min-height: 100vh; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; color: #1a1a1a; }
        .sq-top { position: sticky; top: 0; z-index: 50; background: #fff; border-bottom: 1px solid #eee; }
        .sq-in { max-width: 1100px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .sq-brand { display: flex; align-items: center; gap: 12px; }
        .sq-mark { width: 38px; height: 38px; border-radius: 10px; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
        .sq-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 700; }
        .sq-sub { font-size: 12px; color: #94a3b8; }
        .sq-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .sq-ghost { padding: 8px 14px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; font-size: 13px; cursor: pointer; color: #555; text-decoration: none; font-family: inherit; }
        .sq-ghost:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .sq-body { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .sq-resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 24px; }
        .sq-stat { padding: 12px 14px; border: 2px solid #eee; border-radius: 12px; background: #fff; cursor: pointer; text-align: left; font-family: inherit; transition: all .15s; }
        .sq-stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; color: #64748b; }
        .sq-stat-val { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 700; color: #1a1a1a; }
        .sq-list { display: flex; flex-direction: column; gap: 12px; }
        .sq-card { background: #fff; border: 1px solid #eee; border-radius: 14px; padding: 16px 18px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .sq-info { min-width: 240px; flex: 1; }
        .sq-nome { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .sq-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
        .sq-pix { display: flex; align-items: center; gap: 6px; margin-top: 8px; padding: 8px 10px; background: #f9fafb; border-radius: 8px; }
        .sq-pix-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .sq-pix-key { font-family: monospace; font-size: 12px; color: #1a1a1a; word-break: break-all; flex: 1; }
        .sq-copy { background: transparent; border: none; cursor: pointer; font-size: 14px; }
        .sq-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .sq-valor { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #1a1a1a; }
        .sq-badge { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
        .sq-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .sq-b { color: #fff; border: none; border-radius: 10px; padding: 8px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .sq-b:disabled { opacity: .55; cursor: not-allowed; }
        .sq-empty { padding: 60px 20px; text-align: center; color: #94a3b8; font-size: 14px; }
        .sq-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 200; color: #fff; padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
        @media (max-width: 640px) {
          .sq-right { align-items: stretch; width: 100%; }
          .sq-btns { justify-content: stretch; }
          .sq-b { flex: 1; }
        }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
