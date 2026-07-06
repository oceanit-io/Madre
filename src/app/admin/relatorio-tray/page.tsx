'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ItemP = { sku?: string; id?: string; nome?: string; quantidade?: number }
type Pedido = {
  id: string
  numero_pedido: string
  created_at: string
  status: string
  itens: ItemP[]
}
type Dados = {
  totalPedidos: number
  totalItens: number
  resumo: { sku: string; nome: string; qtd: number }[]
  pedidos: Pedido[]
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function RelatorioTrayPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [d, setD] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
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
      const res = await fetch('/api/admin/relatorio-tray', { headers: authHeaders, cache: 'no-store' })
      if (res.ok) setD(await res.json())
      else flash('Erro ao carregar', 'erro')
    } catch { flash('Erro de conexão', 'erro') }
    setLoading(false)
  }, [authHeaders])

  useEffect(() => { if (autenticado) carregar() }, [autenticado, carregar])

  async function marcar(payload: { ids?: string[]; todos?: boolean }, msg: string) {
    if (busy) return
    if (payload.todos && !confirm('Confirmar que JÁ deu baixa de TODOS estes itens na Tray? Eles somem deste relatório.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/relatorio-tray', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); flash(e?.erro || 'Erro', 'erro'); setBusy(false); return }
      flash(msg, 'ok')
      await carregar()
    } catch { flash('Erro de conexão', 'erro') }
    setBusy(false)
  }

  if (checandoAuth || !autenticado) {
    return <div style={center}><div style={loadingTxt}>Carregando…</div></div>
  }

  return (
    <div className="rt-wrap">
      <header className="rt-top">
        <div className="rt-in">
          <div className="rt-brand">
            <div className="rt-mark">925</div>
            <div>
              <div className="rt-title">Baixa de estoque na Tray</div>
              <div className="rt-sub">
                {d ? `${d.totalPedidos} pedidos · ${d.totalItens} itens a dar baixa` : 'Vendas confirmadas pendentes'}
              </div>
            </div>
          </div>
          <div className="rt-actions">
            <button onClick={carregar} className="rt-ghost" type="button">↻ Atualizar</button>
            <Link href="/admin" className="rt-ghost">← Admin</Link>
            <button onClick={() => { sessionStorage.clear(); router.replace('/admin') }} className="rt-ghost" type="button">Logout</button>
          </div>
        </div>
      </header>

      <div className="rt-body">
        {loading || !d ? (
          <div className="rt-empty"><div style={loadingTxt}>Carregando…</div></div>
        ) : d.resumo.length === 0 ? (
          <div className="rt-card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 18, fontWeight: 700 }}>
              Tudo em dia!
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
              Nenhuma venda pendente de baixa na Tray.
            </div>
          </div>
        ) : (
          <>
            <div className="rt-aviso">
              ⚠️ Dê baixa destas quantidades no estoque da sua <strong>Tray</strong> e
              depois clique em <strong>“Marcar como baixado”</strong> pra não repetir.
            </div>

            <div className="rt-card">
              <div className="rt-h">
                Produtos a dar baixa
                <button
                  onClick={() => marcar({ todos: true }, 'Marcado tudo como baixado ✓')}
                  disabled={busy}
                  className="rt-btn-dark"
                  type="button"
                >
                  ✓ Já dei baixa de TUDO na Tray
                </button>
              </div>
              <div className="rt-tabela">
                <div className="rt-thead">
                  <div>SKU</div><div>Produto</div><div style={{ textAlign: 'right' }}>Qtd</div>
                </div>
                {d.resumo.map(r => (
                  <div key={r.sku} className="rt-row">
                    <div data-l="SKU"><strong>{r.sku}</strong></div>
                    <div data-l="Produto">{r.nome || '—'}</div>
                    <div data-l="Qtd" style={{ textAlign: 'right', fontWeight: 700 }}>{r.qtd}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rt-card">
              <div className="rt-h" style={{ fontSize: 15 }}>Pedidos incluídos ({d.pedidos.length})</div>
              {d.pedidos.map(p => (
                <div key={p.id} className="rt-ped">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{p.numero_pedido}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {fmtData(p.created_at)} · {p.status} ·{' '}
                      {p.itens.reduce((a, i) => a + (Number(i.quantidade) || 1), 0)} itens
                    </div>
                  </div>
                  <button
                    onClick={() => marcar({ ids: [p.id] }, `Pedido ${p.numero_pedido} marcado ✓`)}
                    disabled={busy}
                    className="rt-btn-ghost2"
                    type="button"
                  >
                    Marcar baixado
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="rt-toast" style={{ background: toast.tipo === 'ok' ? '#065F46' : '#991B1B' }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .rt-wrap { min-height: 100vh; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; color: #1a1a1a; }
        .rt-top { position: sticky; top: 0; z-index: 50; background: #fff; border-bottom: 1px solid #eee; }
        .rt-in { max-width: 1000px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .rt-brand { display: flex; align-items: center; gap: 12px; }
        .rt-mark { width: 38px; height: 38px; border-radius: 10px; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
        .rt-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 700; }
        .rt-sub { font-size: 12px; color: #94a3b8; }
        .rt-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .rt-ghost { padding: 8px 14px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; font-size: 13px; cursor: pointer; color: #555; text-decoration: none; font-family: inherit; }
        .rt-ghost:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .rt-body { max-width: 1000px; margin: 0 auto; padding: 24px; }
        .rt-aviso { background: #FFF7ED; border: 1px solid #FED7AA; color: #9A3412; border-radius: 12px; padding: 14px 16px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
        .rt-card { background: #fff; border: 1px solid #eee; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; }
        .rt-h { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .rt-btn-dark { background: #1a1a1a; color: #fff; border: none; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .rt-btn-dark:disabled { opacity: .5; cursor: wait; }
        .rt-btn-ghost2 { background: #fff; border: 1px solid #1a1a1a; color: #1a1a1a; border-radius: 10px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; flex-shrink: 0; }
        .rt-btn-ghost2:disabled { opacity: .5; }
        .rt-thead, .rt-row { display: grid; grid-template-columns: 90px 1fr 70px; gap: 12px; align-items: center; }
        .rt-thead { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #94a3b8; font-weight: 700; padding: 8px 0; border-bottom: 1px solid #eee; }
        .rt-row { padding: 10px 0; border-bottom: 1px solid #f3f3f3; font-size: 14px; }
        .rt-row:last-child { border-bottom: none; }
        .rt-ped { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f3f3f3; }
        .rt-ped:last-child { border-bottom: none; }
        .rt-empty { padding: 60px 20px; text-align: center; }
        .rt-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 200; color: #fff; padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
        @media (max-width: 640px) {
          .rt-thead { display: none; }
          .rt-row { grid-template-columns: 1fr; gap: 4px; padding: 12px 0; }
          .rt-row > div::before { content: attr(data-l) ': '; color: #94a3b8; font-weight: 700; }
          .rt-row > div[data-l='Qtd'] { text-align: left !important; }
        }
      `}</style>
    </div>
  )
}

const center: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }
const loadingTxt: React.CSSProperties = { fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }
