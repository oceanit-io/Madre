'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { statusMeta } from '@/lib/pedidoStatus'
import { SITUACAO_META, type SituacaoMensalidade } from '@/lib/mensalidade'

type Dados = {
  faturamento: { dia: string; total: number }[]
  statusCounts: Record<string, number>
  top: { nome: string; total: number; qtd: number }[]
  mens: Record<string, number> | null
}

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
export default function AdminGraficosPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [d, setD] = useState<Dados | null>(null)
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
      const res = await fetch('/api/admin/graficos', { headers: authHeaders, cache: 'no-store' })
      if (res.ok) setD(await res.json())
    } catch {}
    setLoading(false)
  }, [authHeaders])

  useEffect(() => {
    if (autenticado) carregar()
  }, [autenticado, carregar])

  if (checandoAuth || !autenticado) {
    return <div style={center}><div style={loadingTxt}>Carregando…</div></div>
  }

  const totalFat = d ? d.faturamento.reduce((a, x) => a + x.total, 0) : 0
  const maxFat = d ? Math.max(1, ...d.faturamento.map(x => x.total)) : 1
  const totalStatus = d
    ? Object.values(d.statusCounts).reduce((a, x) => a + x, 0)
    : 0
  const maxTop = d && d.top.length ? Math.max(1, ...d.top.map(t => t.total)) : 1

  return (
    <div className="gr-wrap">
      <header className="gr-top">
        <div className="gr-in">
          <div className="gr-brand">
            <div className="gr-mark">925</div>
            <div>
              <div className="gr-title">Gráficos · Prata 925</div>
              <div className="gr-sub">Visão geral do negócio</div>
            </div>
          </div>
          <div className="gr-actions">
            <button onClick={carregar} className="gr-ghost" type="button">↻ Atualizar</button>
            <Link href="/admin" className="gr-ghost">← Admin</Link>
            <button onClick={() => { sessionStorage.clear(); router.replace('/admin') }} className="gr-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="gr-body">
        {loading || !d ? (
          <div className="gr-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : (
          <div className="gr-grid">
            {/* Faturamento 30 dias */}
            <div className="gr-card gr-span2">
              <div className="gr-h">Faturamento · últimos 30 dias</div>
              <div className="gr-big">{fmtBRL(totalFat)}</div>
              <div className="gr-bars">
                {d.faturamento.map(x => (
                  <div
                    key={x.dia}
                    className="gr-bar"
                    title={`${x.dia.split('-').reverse().join('/')} — ${fmtBRL(x.total)}`}
                  >
                    <div
                      className="gr-bar-fill"
                      style={{ height: `${Math.max(2, (x.total / maxFat) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="gr-axis">
                <span>{d.faturamento[0]?.dia.split('-').reverse().slice(0, 2).join('/')}</span>
                <span>hoje</span>
              </div>
            </div>

            {/* Pedidos por status */}
            <div className="gr-card">
              <div className="gr-h">Pedidos por status</div>
              <div className="gr-big">{totalStatus}</div>
              <div style={{ marginTop: 12 }}>
                {Object.entries(d.statusCounts).map(([s, n]) => {
                  const m = statusMeta(s)
                  const pct = totalStatus ? (n / totalStatus) * 100 : 0
                  return (
                    <div key={s} style={{ marginBottom: 10 }}>
                      <div className="gr-row">
                        <span>{m.label}</span>
                        <strong>{n}</strong>
                      </div>
                      <div className="gr-track">
                        <div style={{ width: `${pct}%`, height: '100%', background: m.text, borderRadius: 999 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top revendedoras */}
            <div className="gr-card">
              <div className="gr-h">Top revendedoras (comissão)</div>
              {d.top.length === 0 ? (
                <div className="gr-vazio">Sem comissões ainda (ou rode comissoes.sql).</div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {d.top.map((t, i) => {
                    const pct = (t.total / maxTop) * 100
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div className="gr-row">
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{t.nome}</span>
                          <strong>{fmtBRL(t.total)}</strong>
                        </div>
                        <div className="gr-track">
                          <div style={{ width: `${pct}%`, height: '100%', background: '#1A1A1A', borderRadius: 999 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Mensalidades */}
            <div className="gr-card gr-span2">
              <div className="gr-h">Mensalidades</div>
              {!d.mens ? (
                <div className="gr-vazio">Rode <code>supabase/mensalidades.sql</code> para ver este gráfico.</div>
              ) : (
                <div className="gr-tiles">
                  {(['em_dia', 'a_vencer', 'vence_hoje', 'vencida', 'isento', 'sem_data'] as SituacaoMensalidade[]).map(k => {
                    const meta = SITUACAO_META[k]
                    return (
                      <div key={k} className="gr-tile" style={{ background: meta.bg }}>
                        <div className="gr-tile-n" style={{ color: meta.text }}>{d.mens?.[k] ?? 0}</div>
                        <div className="gr-tile-l" style={{ color: meta.text }}>{meta.label}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .gr-wrap { min-height: 100vh; background: linear-gradient(180deg, #FDFBFE 0%, #F8FAFD 100%); font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; color: #1a1a1a; }
        .gr-top { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.95); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid #E8ECF1; }
        .gr-in { max-width: 1100px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .gr-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .gr-mark { width: 40px; height: 40px; border-radius: 11px; background: linear-gradient(135deg, #E8396A 0%, #C026D3 50%, #6366F1 100%); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 12px; letter-spacing: .5px; box-shadow: 0 4px 12px rgba(192,38,211,.25); flex-shrink: 0; }
        .gr-title { font-family: 'Montserrat', sans-serif; font-size: 17px; font-weight: 800; color: #0F172A; letter-spacing: -.3px; line-height: 1.2; }
        .gr-sub { font-size: 11.5px; color: #64748B; font-weight: 500; margin-top: 1px; }
        .gr-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .gr-ghost, a.gr-ghost, a.gr-ghost:link, a.gr-ghost:visited, a.gr-ghost:active {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 8px 14px; background: #fff;
          border: 1px solid #E2E8F0; border-radius: 10px;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; color: #475569;
          text-decoration: none;
          transition: all .15s;
          box-shadow: 0 1px 2px rgba(15,23,42,.03);
        }
        .gr-ghost:hover, a.gr-ghost:hover {
          border-color: #6366F1; color: #6366F1; background: #EEF2FF;
          box-shadow: 0 2px 6px rgba(99,102,241,.1);
        }
        .gr-body { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .gr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .gr-span2 { grid-column: span 2; }
        .gr-card { background: #fff; border: 1px solid #E8ECF1; border-radius: 14px; padding: 22px 24px; box-shadow: 0 1px 3px rgba(15,23,42,.04); transition: all .15s; }
        .gr-card:hover { border-color: #CBD5E1; box-shadow: 0 4px 12px rgba(15,23,42,.06); }
        .gr-h { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 800; margin-bottom: 8px; color: #475569; text-transform: uppercase; letter-spacing: .5px; }
        .gr-big { font-family: 'Montserrat', sans-serif; font-size: 30px; font-weight: 900; color: #0F172A; letter-spacing: -.8px; }
        .gr-bars { display: flex; align-items: flex-end; gap: 3px; height: 140px; margin-top: 14px; }
        .gr-bar { flex: 1; height: 100%; display: flex; align-items: flex-end; }
        .gr-bar-fill { width: 100%; background: linear-gradient(180deg, #6366F1 0%, #4F46E5 100%); border-radius: 4px 4px 0 0; min-height: 2px; transition: height .2s; }
        .gr-axis { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-top: 8px; }
        .gr-row { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px; font-weight: 500; }
        .gr-track { width: 100%; height: 8px; background: #F1F5F9; border-radius: 999px; overflow: hidden; }
        .gr-vazio { font-size: 13px; color: #94a3b8; padding: 16px 0; }
        .gr-tiles { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 14px; }
        .gr-tile { border-radius: 12px; padding: 16px 8px; text-align: center; transition: transform .15s; }
        .gr-tile:hover { transform: translateY(-2px); }
        .gr-tile-n { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 900; letter-spacing: -.4px; }
        .gr-tile-l { font-family: 'Montserrat', sans-serif; font-size: 10.5px; font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; opacity: .85; }
        .gr-empty { padding: 60px 20px; text-align: center; }

        /* Mobile refinements */
        @media (max-width: 760px) {
          .gr-grid { grid-template-columns: 1fr; }
          .gr-span2 { grid-column: span 1; }
          .gr-tiles { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .gr-in { padding: 12px 16px; gap: 10px; }
          .gr-title { font-size: 15px; }
          .gr-sub { font-size: 10.5px; }
          .gr-actions { gap: 6px; width: 100%; }
          .gr-ghost, a.gr-ghost { padding: 7px 10px; font-size: 12px; flex: 1; justify-content: center; }
          .gr-body { padding: 16px; }
          .gr-card { padding: 18px 16px; }
          .gr-big { font-size: 24px; }
        }
        @media (max-width: 420px) {
          .gr-mark { width: 36px; height: 36px; font-size: 11px; }
          .gr-title { font-size: 14px; }
          .gr-big { font-size: 22px; }
          .gr-tiles { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
