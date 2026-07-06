'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Financeiro = {
  faturado: number
  produtos: number
  frete: number
  qtdPedidos: number
  ticketMedio: number
  comissoesEfetivas: number
  comissoesProcessando: number
  comissoesPendentes: number
  comissoesCanceladas: number
  liquido: number
  revendedoras30: number
  contaMae: number
  taxas: number
  taxaPct: number
  prata15Bruto: number
  liquidoEmpresa: number
  porRevendedora: { slug: string; nome: string; total: number; qtd: number }[]
  comissoesDetalhe: {
    id: string
    nome: string
    slug: string
    valor: number
    status: string
    data_liberacao: string | null
    criado_em: string
  }[]
}

type Range = 'tudo' | 'hoje' | '7d' | '30d' | 'custom'

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function AdminFinanceiroPage() {
  const router = useRouter()
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [autenticado, setAutenticado] = useState(false)

  const [dados, setDados] = useState<Financeiro | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('30d')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'ok') setAutenticado(true)
    else router.replace('/admin')
    setChecandoAuth(false)
  }, [router])

  function logout() {
    try {
      sessionStorage.removeItem('admin_auth')
      sessionStorage.clear()
    } catch {}
    router.replace('/admin')
  }

  const authHeaders = useMemo(
    () => ({}),
    []
  )

  function calcularRange(): { de: string; ate: string } {
    const now = new Date()
    if (range === 'hoje') {
      const ini = new Date()
      ini.setHours(0, 0, 0, 0)
      return { de: ini.toISOString(), ate: now.toISOString() }
    }
    if (range === '7d')
      return {
        de: new Date(Date.now() - 7 * 86400000).toISOString(),
        ate: now.toISOString(),
      }
    if (range === '30d')
      return {
        de: new Date(Date.now() - 30 * 86400000).toISOString(),
        ate: now.toISOString(),
      }
    if (range === 'custom')
      return {
        de: de ? new Date(`${de}T00:00:00`).toISOString() : '',
        ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : '',
      }
    return { de: '', ate: '' }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = calcularRange()
      const params = new URLSearchParams()
      if (r.de) params.set('de', r.de)
      if (r.ate) params.set('ate', r.ate)
      const res = await fetch(
        `/api/admin/financeiro?${params.toString()}`,
        { headers: authHeaders, cache: 'no-store' }
      )
      if (res.ok) setDados(await res.json())
    } catch {}
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders, range, de, ate])

  useEffect(() => {
    if (!autenticado) return
    carregar()
  }, [autenticado, carregar])

  if (checandoAuth || !autenticado) {
    return (
      <div style={wrapCenter}>
        <div style={loadingTxt}>Carregando…</div>
      </div>
    )
  }

  const kpis = dados
    ? [
        { label: 'Faturado (bruto)', val: formatBRL(dados.faturado), sub: `${dados.qtdPedidos} pedidos pagos`, bg: '#ECFDF5' },
        { label: 'Produtos (subtotal)', val: formatBRL(dados.produtos), sub: 'sem frete', bg: '#F5F5F5' },
        { label: 'Frete arrecadado', val: formatBRL(dados.frete), sub: 'repassado à entrega', bg: '#F5F5F5' },
        { label: 'Comissões (30%)', val: formatBRL(dados.comissoesEfetivas + dados.comissoesProcessando), sub: `${formatBRL(dados.comissoesProcessando)} em análise + ${formatBRL(dados.comissoesEfetivas)} liberadas`, bg: '#FFF7ED' },
      ]
    : []

  return (
    <div className="fin-wrap">
      <header className="fin-top">
        <div className="fin-top-inner">
          <div className="fin-brand">
            <div className="fin-mark">925</div>
            <div>
              <div className="fin-title">Financeiro · Prata 925</div>
              <div className="fin-sub">Resultado do negócio</div>
            </div>
          </div>
          <div className="fin-actions">
            <Link href="/admin/pedidos" className="fin-btn-ghost">
              Pedidos
            </Link>
            <Link href="/admin" className="fin-btn-ghost">
              ← Admin
            </Link>
            <button onClick={logout} className="fin-btn-ghost" type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="fin-body">
        {/* Filtro de período */}
        <div className="fin-filtros">
          {(
            [
              ['tudo', 'Tudo'],
              ['hoje', 'Hoje'],
              ['7d', '7 dias'],
              ['30d', '30 dias'],
              ['custom', 'Personalizado'],
            ] as [Range, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className="fin-chip"
              style={
                range === k
                  ? { background: '#1A1A1A', color: 'white', borderColor: '#1A1A1A' }
                  : {}
              }
              type="button"
            >
              {label}
            </button>
          ))}
          {range === 'custom' && (
            <>
              <input type="date" value={de} onChange={e => setDe(e.target.value)} className="fin-date" />
              <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="fin-date" />
            </>
          )}
        </div>

        {loading || !dados ? (
          <div className="fin-empty">
            <div style={loadingTxt}>Carregando…</div>
          </div>
        ) : (
          <>
            {/* Líquido destacado */}
            <div className="fin-liquido">
              <div className="fin-liquido-label">Líquido do negócio</div>
              <div className="fin-liquido-val">{formatBRL(dados.liquido)}</div>
              <div className="fin-liquido-formula">
                Faturado {formatBRL(dados.faturado)} − Frete{' '}
                {formatBRL(dados.frete)} − Comissões{' '}
                {formatBRL(dados.comissoesEfetivas + dados.comissoesProcessando)}
              </div>
            </div>

            {/* Reflexo financeiro — valores principais */}
            <div className="fin-card" style={{ borderLeft: '4px solid #1A7F5A' }}>
              <div className="fin-card-title">Reflexo financeiro</div>
              <div className="fin-linha">
                <span>🛒 Venda bruta (faturado)</span>
                <strong>{formatBRL(dados.faturado)}</strong>
              </div>
              <div className="fin-linha">
                <span>💃 Revendedoras (30%)</span>
                <strong>{formatBRL(dados.revendedoras30)}</strong>
              </div>
              <div
                className="fin-linha"
                style={{ borderTop: '1px solid #E5E5E5', marginTop: 6, paddingTop: 8 }}
              >
                <span><strong>💰 Venda líquida (empresa)</strong></span>
                <strong
                  style={{
                    color: dados.liquidoEmpresa >= 0 ? '#1A7F5A' : '#C0392B',
                    fontSize: 17,
                  }}
                >
                  {formatBRL(dados.liquidoEmpresa)}
                </strong>
              </div>
            </div>

            {/* KPIs */}
            <div className="fin-kpis">
              {kpis.map((k, i) => (
                <div key={i} className="fin-kpi" style={{ background: k.bg }}>
                  <div className="fin-kpi-label">{k.label}</div>
                  <div className="fin-kpi-val">{k.val}</div>
                  <div className="fin-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Detalhe comissões */}
            <div className="fin-card">
              <div className="fin-card-title">Comissões</div>
              <div className="fin-linha">
                <span>🔒 Em análise (20d — trocas/devoluções)</span>
                <strong>{formatBRL(dados.comissoesProcessando)}</strong>
              </div>
              <div className="fin-linha">
                <span>✓ Liberadas / pagas</span>
                <strong>{formatBRL(dados.comissoesEfetivas)}</strong>
              </div>
              <div className="fin-linha">
                <span>Pendentes (revendedora não resolvida)</span>
                <strong>{formatBRL(dados.comissoesPendentes)}</strong>
              </div>
              <div className="fin-linha" style={{ color: '#94A3B8' }}>
                <span>Canceladas (não contam)</span>
                <span>{formatBRL(dados.comissoesCanceladas)}</span>
              </div>
              <div className="fin-linha fin-linha-extra">
                <span>Ticket médio</span>
                <strong>{formatBRL(dados.ticketMedio)}</strong>
              </div>
            </div>

            {/* Por revendedora */}
            <div className="fin-card">
              <div className="fin-card-title">
                Comissões por revendedora
              </div>
              {dados.porRevendedora.length === 0 ? (
                <div style={{ fontSize: 14, color: '#94A3B8', padding: '12px 0' }}>
                  Nenhuma comissão liberada neste período.
                </div>
              ) : (
                dados.porRevendedora.map(r => (
                  <div key={r.slug} className="fin-rev">
                    <div style={{ minWidth: 0 }}>
                      <div className="fin-rev-nome">{r.nome}</div>
                      <div className="fin-rev-sub">
                        {r.qtd} {r.qtd === 1 ? 'comissão' : 'comissões'} · {r.slug}
                      </div>
                    </div>
                    <div className="fin-rev-val">{formatBRL(r.total)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Cronograma de liberação — pra conciliar com o extrato do banco */}
            {dados.comissoesDetalhe && dados.comissoesDetalhe.length > 0 && (
              <div className="fin-card">
                <div className="fin-card-title">Cronograma de liberação das comissões</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>
                  Cada comissão só pode ser paga a partir da data de liberação (20 dias após o pedido pago).
                  Use pra conciliar com o extrato do banco.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748B', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '6px 8px' }}>Libera em</th>
                        <th style={{ padding: '6px 8px' }}>Revendedora</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Valor</th>
                        <th style={{ padding: '6px 8px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.comissoesDetalhe.map(c => {
                        const liberada = c.status === 'liberada' || c.status === 'paga'
                        const dataFmt = c.data_liberacao ? new Date(c.data_liberacao).toLocaleDateString('pt-BR') : '—'
                        const lbl = c.status === 'processando' ? 'Em análise' : c.status === 'paga' ? 'Paga' : 'Liberada'
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 700, color: liberada ? '#15803D' : '#B45309', whiteSpace: 'nowrap' }}>{dataFmt}</td>
                            <td style={{ padding: '6px 8px' }}>{c.nome}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatBRL(c.valor)}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', background: liberada ? '#DCFCE7' : '#FEF3C7', color: liberada ? '#15803D' : '#92400E' }}>{lbl}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6, marginTop: 16 }}>
              Dados reais de <code>comissoes</code> + <code>pedidos</code> (status
              pago/enviado/entregue). Comissão = 30% do subtotal. As comissões
              liberadas já entram no saldo das revendedoras automaticamente.
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .fin-wrap {
          min-height: 100vh;
          background: #fafafa;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
          color: #1a1a1a;
        }
        .fin-top {
          position: sticky;
          top: 0;
          z-index: 50;
          background: white;
          border-bottom: 1px solid #eee;
        }
        .fin-top-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .fin-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .fin-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #1a1a1a;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
        }
        .fin-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
        }
        .fin-sub {
          font-size: 12px;
          color: #94a3b8;
        }
        .fin-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .fin-btn-ghost {
          padding: 8px 14px;
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          font-size: 13px;
          cursor: pointer;
          color: #555;
          text-decoration: none;
          font-family: inherit;
        }
        .fin-btn-ghost:hover {
          border-color: #1a1a1a;
          color: #1a1a1a;
        }
        .fin-body {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 24px 60px;
        }
        .fin-filtros {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }
        .fin-chip {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid #eee;
          background: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          color: #555;
        }
        .fin-date {
          padding: 8px 12px;
          border: 1px solid #eee;
          border-radius: 12px;
          font-size: 13px;
          font-family: inherit;
        }
        .fin-liquido {
          background: #1a1a1a;
          color: white;
          border-radius: 16px;
          padding: 28px 32px;
          margin-bottom: 20px;
        }
        .fin-liquido-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #b0b0b0;
          margin-bottom: 8px;
        }
        .fin-liquido-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 40px;
          font-weight: 700;
          line-height: 1;
        }
        .fin-liquido-formula {
          font-size: 12px;
          color: #b0b0b0;
          margin-top: 10px;
        }
        .fin-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }
        .fin-kpi {
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 18px;
        }
        .fin-kpi-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
        }
        .fin-kpi-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.1;
        }
        .fin-kpi-sub {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }
        .fin-card {
          background: white;
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 16px;
        }
        .fin-card-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 14px;
        }
        .fin-linha {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          color: #555;
          padding: 8px 0;
          border-bottom: 1px solid #f3f3f3;
        }
        .fin-linha:last-child {
          border-bottom: none;
        }
        .fin-linha-extra {
          margin-top: 4px;
          border-top: 1px solid #eee;
          border-bottom: none;
          padding-top: 12px;
        }
        .fin-rev {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f3f3f3;
        }
        .fin-rev:last-child {
          border-bottom: none;
        }
        .fin-rev-nome {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fin-rev-sub {
          font-size: 12px;
          color: #94a3b8;
        }
        .fin-rev-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 16px;
          font-weight: 700;
          color: #1a1a1a;
          white-space: nowrap;
        }
        .fin-empty {
          padding: 60px 20px;
          text-align: center;
        }
        @media (max-width: 900px) {
          .fin-kpis {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 540px) {
          .fin-kpis {
            grid-template-columns: 1fr;
          }
          .fin-liquido-val {
            font-size: 32px;
          }
        }
      `}</style>
    </div>
  )
}

const wrapCenter: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#FAFAFA',
}
const loadingTxt: React.CSSProperties = {
  fontSize: 13,
  color: '#94A3B8',
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontWeight: 600,
}
