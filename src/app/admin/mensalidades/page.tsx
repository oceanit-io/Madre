'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SITUACAO_META, type SituacaoMensalidade } from '@/lib/mensalidade'

type Row = {
  id: string
  nome: string
  nome_loja: string | null
  subdominio: string
  whatsapp: string | null
  status: string
  saldo_disponivel: number
  mensalidade_vence_em: string | null
  mensalidade_isento: boolean
  situacao: SituacaoMensalidade
  dias: number | null
}

function fmtData(d: string | null) {
  if (!d) return '—'
  return d.split('-').reverse().join('/')
}
function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
// Link de WhatsApp com lembrete de renovação já preenchido. null se sem número.
function waLembrete(r: Row, valor: number): string | null {
  const tel = (r.whatsapp || '').replace(/\D/g, '')
  if (tel.length < 10) return null
  const numero = tel.startsWith('55') ? tel : `55${tel}`
  const loja = r.nome_loja ? ` ${r.nome_loja}` : ''
  let msg: string
  if (r.status === 'pendente') {
    // Nunca ativou — lembrete pra COMPLETAR o cadastro, não renovação.
    msg = `Oi ${r.nome}! 💎 Vi que sua loja${loja} ainda não foi ativada. Pra começar a vender é só completar o pagamento do cadastro (${fmtBRL(valor)}). Qualquer dúvida tô por aqui pra te ajudar! 🩷`
  } else {
    const venc = fmtData(r.mensalidade_vence_em)
    msg = `Oi ${r.nome}! 💎 Passando pra lembrar que a mensalidade da sua loja${loja} vence em ${venc}. Pra manter a loja ativa e suas vendas no ar é só renovar (${fmtBRL(valor)}). Qualquer dúvida tô por aqui! 🩷`
  }
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
}

export default function AdminMensalidadesPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [valor, setValor] = useState(39.90)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaDeb, setBuscaDeb] = useState('')
  const [filtro, setFiltro] = useState<'ativas' | 'vencendo' | 'vencidas' | 'pendentes'>('ativas')
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

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (buscaDeb.trim()) p.set('busca', buscaDeb.trim())
      const res = await fetch(`/api/admin/mensalidades?${p.toString()}`, {
        headers: authHeaders,
        cache: 'no-store',
      })
      if (!res.ok) { flash('Erro ao carregar', 'erro'); setLoading(false); return }
      const d = await res.json()
      setRows(d.revendedoras || [])
      setValor(d.valor || 39.90)
    } catch { flash('Erro de conexão', 'erro') }
    setLoading(false)
  }, [authHeaders, buscaDeb])

  useEffect(() => {
    if (autenticado) carregar()
  }, [autenticado, carregar])

  async function acao(id: string, acao: string, confirmar?: string) {
    if (savingId) return
    if (confirmar && !confirm(confirmar)) return
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/mensalidades/${id}`, {
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

  async function rodarCron() {
    flash('Rodando verificação...', 'ok')
    try {
      const res = await fetch('/api/cron/mensalidades', { headers: authHeaders, cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) { flash(d?.erro || 'Erro', 'erro'); return }
      flash(`OK: ${d.avisados} avisados · ${d.vencem_hoje} vencem hoje · ${d.suspensos} suspensos`, 'ok')
      await carregar()
    } catch { flash('Erro de conexão', 'erro') }
  }

  // Próximas a vencer (≤7 dias, ainda não vencidas) e vencidas — pra mandar
  // lembrete. Ignora isentas (não pagam mensalidade).
  const countVencendo = useMemo(
    () => rows.filter(r => !r.mensalidade_isento && r.dias != null && r.dias >= 0 && r.dias <= 7).length,
    [rows]
  )
  const countVencidas = useMemo(
    () => rows.filter(r => r.status !== 'pendente' && !r.mensalidade_isento && r.dias != null && r.dias < 0).length,
    [rows]
  )
  const countAtivas = useMemo(() => rows.filter(r => r.status !== 'pendente').length, [rows])
  const countPendentes = useMemo(() => rows.filter(r => r.status === 'pendente').length, [rows])
  const rowsFiltradas = useMemo(() => {
    if (filtro === 'vencendo') return rows.filter(r => r.status !== 'pendente' && !r.mensalidade_isento && r.dias != null && r.dias >= 0 && r.dias <= 7)
    if (filtro === 'vencidas') return rows.filter(r => r.status !== 'pendente' && !r.mensalidade_isento && r.dias != null && r.dias < 0)
    if (filtro === 'pendentes') return rows.filter(r => r.status === 'pendente')
    return rows.filter(r => r.status !== 'pendente') // 'ativas' = com mensalidade (oculta as pendentes)
  }, [rows, filtro])

  if (checandoAuth || !autenticado) {
    return <div style={center}><div style={loadingTxt}>Carregando…</div></div>
  }

  return (
    <div className="mn-wrap">
      <header className="mn-top">
        <div className="mn-in">
          <div className="mn-brand">
            <div className="mn-mark">925</div>
            <div>
              <div className="mn-title">Mensalidades · Prata 925</div>
              <div className="mn-sub">{rows.length} revendedoras · {fmtBRL(valor)}/mês</div>
            </div>
          </div>
          <div className="mn-actions">
            <button onClick={rodarCron} className="mn-ghost" type="button">▶ Rodar verificação</button>
            <Link href="/admin" className="mn-ghost">← Admin</Link>
            <button onClick={() => { sessionStorage.clear(); router.replace('/admin') }} className="mn-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="mn-body">
        <input
          className="mn-input"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou subdomínio…"
        />

        {/* Filtros rápidos pra achar quem precisa de lembrete */}
        <div className="mn-chips">
          <button type="button" onClick={() => setFiltro('ativas')} className={`mn-chip${filtro === 'ativas' ? ' on' : ''}`}>Ativas ({countAtivas})</button>
          <button type="button" onClick={() => setFiltro('vencendo')} className={`mn-chip${filtro === 'vencendo' ? ' on' : ''}`}>Vence em ≤7 dias ({countVencendo})</button>
          <button type="button" onClick={() => setFiltro('vencidas')} className={`mn-chip${filtro === 'vencidas' ? ' on' : ''}`}>Vencidas ({countVencidas})</button>
          <button type="button" onClick={() => setFiltro('pendentes')} className={`mn-chip${filtro === 'pendentes' ? ' on' : ''}`}>⏳ Pendentes p/ completar pagamento ({countPendentes})</button>
        </div>

        {loading ? (
          <div className="mn-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : rowsFiltradas.length === 0 ? (
          <div className="mn-empty">Nenhuma revendedora nesse filtro.</div>
        ) : (
          <div className="mn-list">
            {rowsFiltradas.map(r => {
              const meta = SITUACAO_META[r.situacao]
              const podeDebitar = r.saldo_disponivel >= valor
              return (
                <div key={r.id} className="mn-card">
                  <div className="mn-info">
                    <div className="mn-nome">{r.nome_loja || r.nome}</div>
                    <div className="mn-meta">
                      {r.subdominio} · status {r.status} · saldo {fmtBRL(r.saldo_disponivel)}
                    </div>
                    <div className="mn-meta">
                      Vence: <strong>{fmtData(r.mensalidade_vence_em)}</strong>
                      {r.dias != null && !r.mensalidade_isento && (
                        <span> ({r.dias < 0 ? `${-r.dias}d vencida` : `faltam ${r.dias}d`})</span>
                      )}
                    </div>
                  </div>
                  <div className="mn-right">
                    <span className="mn-badge" style={{ background: meta.bg, color: meta.text }}>
                      {meta.label}
                    </span>
                    <div className="mn-btns">
                      {!r.mensalidade_isento && waLembrete(r, valor) && (
                        <a href={waLembrete(r, valor)!} target="_blank" rel="noopener noreferrer" className="mn-b" style={{ background: '#16A34A', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>📲 Lembrar</a>
                      )}
                      <button disabled={savingId === r.id} onClick={() => acao(r.id, 'pagar')} className="mn-b" style={{ background: '#065F46' }}>✓ Pagou (+30d)</button>
                      <button disabled={savingId === r.id || !podeDebitar} onClick={() => acao(r.id, 'debitar_saldo', `Debitar ${fmtBRL(valor)} do saldo de ${r.nome}?`)} className="mn-b" style={{ background: podeDebitar ? '#1E40AF' : '#9CA3AF' }} title={podeDebitar ? '' : 'Saldo insuficiente'}>Debitar saldo</button>
                      {r.mensalidade_isento
                        ? <button disabled={savingId === r.id} onClick={() => acao(r.id, 'cobrar')} className="mn-b" style={{ background: '#92400E' }}>Cobrar</button>
                        : <button disabled={savingId === r.id} onClick={() => acao(r.id, 'isentar', `Isentar ${r.nome} da mensalidade?`)} className="mn-b" style={{ background: '#64748B' }}>Isentar</button>}
                      {r.status === 'suspensa'
                        ? <button disabled={savingId === r.id} onClick={() => acao(r.id, 'reativar')} className="mn-b" style={{ background: '#065F46' }}>Reativar loja</button>
                        : <button disabled={savingId === r.id} onClick={() => acao(r.id, 'suspender', `Suspender a loja de ${r.nome}?`)} className="mn-b" style={{ background: '#991B1B' }}>Suspender</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="mn-toast" style={{ background: toast.tipo === 'ok' ? '#065F46' : '#991B1B' }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .mn-wrap { min-height: 100vh; background: linear-gradient(180deg, #FDFBFE 0%, #F8FAFD 100%); font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; color: #1a1a1a; }
        .mn-top { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.95); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid #E8ECF1; }
        .mn-in { max-width: 1100px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .mn-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .mn-mark { width: 40px; height: 40px; border-radius: 11px; background: linear-gradient(135deg, #E8396A 0%, #C026D3 50%, #6366F1 100%); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 12px; letter-spacing: .5px; box-shadow: 0 4px 12px rgba(192,38,211,.25); flex-shrink: 0; }
        .mn-title { font-family: 'Montserrat', sans-serif; font-size: 17px; font-weight: 800; color: #0F172A; letter-spacing: -.3px; line-height: 1.2; }
        .mn-sub { font-size: 11.5px; color: #64748B; font-weight: 500; margin-top: 1px; }
        .mn-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        /* Aplica em button E em a (Next Link). Inclui :link/:visited pra browser
           não sobrescrever com cor de visitado (azul/violeta). */
        .mn-ghost, a.mn-ghost, a.mn-ghost:link, a.mn-ghost:visited, a.mn-ghost:active {
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
        .mn-ghost:hover, a.mn-ghost:hover {
          border-color: #6366F1; color: #6366F1; background: #EEF2FF;
          box-shadow: 0 2px 6px rgba(99,102,241,.1);
        }
        .mn-body { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .mn-input { width: 100%; padding: 12px 16px; border: 1px solid #E2E8F0; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 20px; background: #fff; transition: all .15s; box-sizing: border-box; }
        .mn-input:focus { border-color: #6366F1; box-shadow: 0 0 0 4px rgba(99,102,241,.1); }
        .mn-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .mn-chip { padding: 8px 14px; border: 1px solid #E2E8F0; border-radius: 999px; background: #fff; font-family: 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; transition: all .15s; }
        .mn-chip:hover { border-color: #6366F1; color: #6366F1; }
        .mn-chip.on { background: #6366F1; border-color: #6366F1; color: #fff; }
        .mn-list { display: flex; flex-direction: column; gap: 12px; }
        .mn-card { background: #fff; border: 1px solid #E8ECF1; border-radius: 14px; padding: 18px 20px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; transition: all .15s; box-shadow: 0 1px 3px rgba(15,23,42,.04); }
        .mn-card:hover { border-color: #CBD5E1; box-shadow: 0 4px 12px rgba(15,23,42,.06); }
        .mn-info { min-width: 220px; flex: 1; }
        .mn-nome { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 4px; letter-spacing: -.1px; }
        .mn-meta { font-size: 12px; color: #64748B; margin-top: 2px; font-weight: 500; }
        .mn-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .mn-badge { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px; letter-spacing: .3px; text-transform: uppercase; }
        .mn-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .mn-b { color: #fff; border: none; border-radius: 10px; padding: 9px 14px; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; transition: all .15s; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .mn-b:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,.12); }
        .mn-b:disabled { opacity: .45; cursor: not-allowed; }
        .mn-empty { padding: 60px 20px; text-align: center; color: #94a3b8; font-size: 14px; }
        .mn-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 200; color: #fff; padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.2); }

        /* Mobile-first refinements */
        @media (max-width: 720px) {
          .mn-in { padding: 12px 16px; gap: 10px; }
          .mn-title { font-size: 15px; }
          .mn-sub { font-size: 10.5px; }
          .mn-actions { gap: 6px; width: 100%; }
          .mn-ghost, a.mn-ghost { padding: 7px 10px; font-size: 12px; flex: 1; justify-content: center; }
          .mn-body { padding: 16px; }
          .mn-card { padding: 14px 16px; }
        }
        @media (max-width: 640px) {
          .mn-right { align-items: stretch; width: 100%; }
          .mn-btns { justify-content: stretch; }
          .mn-b { flex: 1; min-width: 0; }
        }
        @media (max-width: 480px) {
          .mn-mark { width: 36px; height: 36px; font-size: 11px; }
          .mn-title { font-size: 14px; }
          .mn-nome { font-size: 14px; }
          .mn-meta { font-size: 11.5px; }
        }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
