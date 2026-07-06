'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AtualizarBtn from '@/components/admin/AtualizarBtn'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  STATUS_FLUXO,
  statusMeta,
  isAbandonado,
} from '@/lib/pedidoStatus'

// ---------------- Tipos ----------------
type ItemPedido = {
  id: string
  sku: string
  nome: string
  preco: number
  foto: string
  quantidade: number
  variacao?: string
  ref?: string
}

type Pedido = {
  id: string
  numero_pedido: string
  created_at: string
  status: string
  cliente_nome: string
  cliente_email: string
  cliente_cpf: string
  cliente_telefone: string
  endereco_cep: string
  endereco_rua: string
  endereco_numero: string
  endereco_complemento: string | null
  endereco_bairro: string
  endereco_cidade: string
  endereco_uf: string
  itens: ItemPedido[]
  subtotal: number
  frete: number
  total: number
  regiao_frete: string | null
  slug_revendedora: string | null
  observacoes: string | null
  nome_revendedora?: string | null
  status_comissao?: string | null
}

type HistoricoItem = {
  id: string
  status_anterior: string | null
  status_novo: string
  observacao: string | null
  created_at: string
  created_by: string | null
}

type Comissao = {
  id: string
  valor_base: number
  percentual: number
  valor_comissao: number
  status: string
  data_liberacao: string | null
  data_pagamento: string | null
}

type Revendedora = {
  nome: string
  nome_loja: string | null
  whatsapp: string
  subdominio: string
}

type Detalhe = Pedido & {
  historico: HistoricoItem[]
  comissao: Comissao | null
  revendedora: Revendedora | null
}

// ---------------- Helpers ----------------
function formatBRL(val: number) {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatData(iso: string, comAno = false) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    ...(comAno ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const horas = Math.floor(ms / 3600000)
  if (horas < 1) return 'há poucos minutos'
  if (horas < 24) return `há ${horas}h`
  const dias = Math.floor(horas / 24)
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

function maskCPF(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11)
  if (d.length !== 11) return v
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCEP(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 8)
  if (d.length !== 8) return v
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function maskTelefone(v: string) {
  const d = (v || '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}

const COMISSAO_META: Record<string, { label: string; bg: string; text: string }> = {
  pendente: { label: 'Pendente', bg: '#FEF3C7', text: '#92400E' },
  liberada: { label: 'Liberada', bg: '#DBEAFE', text: '#1E40AF' },
  paga: { label: 'Paga', bg: '#D1FAE5', text: '#065F46' },
  cancelada: { label: 'Cancelada', bg: '#FEE2E2', text: '#991B1B' },
}

const FILTRO_STATUS = [
  { v: '', label: 'Todos' },
  { v: 'aguardando_pagamento', label: 'Aguardando' },
  { v: 'pago', label: 'Pago' },
  { v: 'enviado', label: 'Enviado' },
  { v: 'entregue', label: 'Entregue' },
  { v: 'cancelado', label: 'Cancelado' },
  { v: 'abandonados', label: 'Abandonados' },
]

const PER_PAGE = 20

export default function AdminPedidosPage() {
  const router = useRouter()

  const [autenticado, setAutenticado] = useState(false)
  const [checandoAuth, setChecandoAuth] = useState(true)

  const [metricas, setMetricas] = useState<{
    vendas_hoje: number
    pedidos_hoje: number
    aguardando_pagamento: number
    abandonados: number
    funil30d?: {
      criados: number
      pagos: number
      pendentes: number
      cancelados: number
      valor_pago: number
      valor_perdido: number
      conversao: number
    }
  } | null>(null)

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null)
  const [revendedorasFiltro, setRevendedorasFiltro] = useState<
    { slug: string; nome: string }[]
  >([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [fStatus, setFStatus] = useState('')
  const [fRevendedora, setFRevendedora] = useState('')
  const [fRange, setFRange] = useState<'todos' | 'hoje' | '7d' | '30d' | 'custom'>('todos')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')

  // Modal
  const [modalId, setModalId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)
  const [acaoLoading, setAcaoLoading] = useState(false)
  const [obsAberta, setObsAberta] = useState(false)
  const [obsTexto, setObsTexto] = useState('')
  const [histAberto, setHistAberto] = useState(false)

  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function mostrarToast(msg: string, tipo: 'ok' | 'erro') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tipo })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  // ---------- Auth guard (replica /admin) ----------
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'ok') {
      setAutenticado(true)
    } else {
      router.replace('/admin')
    }
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

  // ---------- Debounce busca (300ms) ----------
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  // ---------- Reset page quando filtros mudam ----------
  useEffect(() => {
    setPage(1)
  }, [fStatus, fRevendedora, fRange, fDe, fAte, buscaDebounced])

  // ---------- Range helper ----------
  function calcularRange(): { de: string; ate: string } {
    const now = new Date()
    if (fRange === 'hoje') {
      const ini = new Date()
      ini.setHours(0, 0, 0, 0)
      return { de: ini.toISOString(), ate: now.toISOString() }
    }
    if (fRange === '7d') {
      return {
        de: new Date(Date.now() - 7 * 86400000).toISOString(),
        ate: now.toISOString(),
      }
    }
    if (fRange === '30d') {
      return {
        de: new Date(Date.now() - 30 * 86400000).toISOString(),
        ate: now.toISOString(),
      }
    }
    if (fRange === 'custom') {
      const de = fDe ? new Date(`${fDe}T00:00:00`).toISOString() : ''
      const ate = fAte ? new Date(`${fAte}T23:59:59`).toISOString() : ''
      return { de, ate }
    }
    return { de: '', ate: '' }
  }

  // ---------- Carregar métricas ----------
  const carregarMetricas = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/metricas', { headers: authHeaders })
      if (res.ok) setMetricas(await res.json())
    } catch {}
  }, [authHeaders])

  // ---------- Carregar pedidos ----------
  const carregarPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const { de, ate } = calcularRange()
      const params = new URLSearchParams()
      if (fStatus) params.set('status', fStatus)
      if (fRevendedora) params.set('revendedora', fRevendedora)
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      if (buscaDebounced.trim()) params.set('busca', buscaDebounced.trim())
      params.set('page', String(page))
      params.set('per_page', String(PER_PAGE))

      const res = await fetch(`/api/admin/pedidos?${params.toString()}`, {
        headers: authHeaders,
      })
      if (!res.ok) {
        mostrarToast('Erro ao carregar pedidos', 'erro')
        setLoading(false)
        return
      }
      const data = await res.json()
      setPedidos(data.pedidos || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
      setRevendedorasFiltro(data.revendedoras || [])
    } catch {
      mostrarToast('Erro de conexão', 'erro')
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders, fStatus, fRevendedora, fRange, fDe, fAte, buscaDebounced, page])

  useEffect(() => {
    if (!autenticado) return
    carregarMetricas()
  }, [autenticado, carregarMetricas])

  useEffect(() => {
    if (!autenticado) return
    carregarPedidos()
  }, [autenticado, carregarPedidos])

  // Refresh manual: re-fetcha métricas + pedidos juntos.
  const refreshTudo = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([carregarMetricas(), carregarPedidos()])
    } finally {
      setRefreshing(false)
      setUltimaAtualizacao(Date.now())
    }
  }, [carregarMetricas, carregarPedidos])

  // ---------- Modal: carregar detalhe ----------
  const abrirDetalhe = useCallback(
    async (id: string) => {
      setModalId(id)
      setDetalhe(null)
      setObsAberta(false)
      setObsTexto('')
      setHistAberto(false)
      setDetalheLoading(true)
      try {
        const res = await fetch(`/api/admin/pedidos/${id}`, {
          headers: authHeaders,
        })
        if (res.ok) {
          setDetalhe(await res.json())
        } else {
          mostrarToast('Erro ao carregar detalhe', 'erro')
          setModalId(null)
        }
      } catch {
        mostrarToast('Erro de conexão', 'erro')
        setModalId(null)
      }
      setDetalheLoading(false)
    },
    [authHeaders]
  )

  function fecharModal() {
    setModalId(null)
    setDetalhe(null)
  }

  // ESC fecha modal
  useEffect(() => {
    if (!modalId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fecharModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalId])

  // ---------- Ações (PATCH) ----------
  async function patchPedido(payload: { status?: string; observacao?: string }) {
    if (!modalId) return
    setAcaoLoading(true)
    try {
      const res = await fetch(`/api/admin/pedidos/${modalId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        mostrarToast(data?.erro || 'Erro ao atualizar', 'erro')
        setAcaoLoading(false)
        return
      }
      setDetalhe(data)
      setObsAberta(false)
      setObsTexto('')
      mostrarToast('Atualizado com sucesso', 'ok')
      carregarPedidos()
      carregarMetricas()
    } catch {
      mostrarToast('Erro de conexão', 'erro')
    }
    setAcaoLoading(false)
  }

  function mudarStatus(novo: string) {
    patchPedido({ status: novo })
  }

  function cancelarPedido() {
    if (
      !confirm('Tem certeza que deseja CANCELAR este pedido?')
    )
      return
    patchPedido({ status: 'cancelado' })
  }

  function salvarObservacao() {
    const txt = obsTexto.trim()
    if (!txt) return
    patchPedido({ observacao: txt })
  }

  async function copiar(texto: string, msg: string) {
    try {
      await navigator.clipboard.writeText(texto)
      mostrarToast(msg, 'ok')
    } catch {
      mostrarToast('Não foi possível copiar', 'erro')
    }
  }

  function limparFiltros() {
    setFStatus('')
    setFRevendedora('')
    setFRange('todos')
    setFDe('')
    setFAte('')
    setBusca('')
  }

  // ---------- Render guards ----------
  if (checandoAuth || !autenticado) {
    return (
      <div style={loadingWrap}>
        <div style={loadingTxt}>Carregando…</div>
      </div>
    )
  }

  const cards = [
    {
      icon: '💰',
      label: 'Vendas hoje',
      val: metricas ? formatBRL(metricas.vendas_hoje) : '—',
      bg: '#ECFDF5',
    },
    {
      icon: '📦',
      label: 'Pedidos hoje',
      val: metricas ? String(metricas.pedidos_hoje) : '—',
      bg: '#F5F5F5',
    },
    {
      icon: '⏳',
      label: 'Aguardando',
      val: metricas ? String(metricas.aguardando_pagamento) : '—',
      bg: '#FFFBEB',
    },
    {
      icon: '⚠️',
      label: 'Abandonados',
      val: metricas ? String(metricas.abandonados) : '—',
      bg: '#FFF7ED',
    },
  ]

  return (
    <div className="ap-wrap">
      {/* Header sticky */}
      <header className="ap-top">
        <div className="ap-top-inner">
          <div className="ap-brand">
            <div className="ap-mark">925</div>
            <div>
              <div className="ap-title">Pedidos · Prata 925</div>
              <div className="ap-sub">{total} no total</div>
            </div>
          </div>
          <div className="ap-actions">
            <AtualizarBtn
              onClick={refreshTudo}
              loading={refreshing}
              ultimaAtualizacao={ultimaAtualizacao}
            />
            <Link href="/admin/financeiro" className="ap-btn-ghost">
              Financeiro
            </Link>
            <Link href="/admin" className="ap-btn-ghost">
              ← Voltar ao admin
            </Link>
            <button onClick={logout} className="ap-btn-ghost" type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="ap-body">
        {/* Métricas */}
        <div className="ap-metrics">
          {cards.map((c, i) => (
            <div key={i} className="ap-metric" style={{ background: c.bg }}>
              <div className="ap-metric-icon">{c.icon}</div>
              <div className="ap-metric-val">{c.val}</div>
              <div className="ap-metric-label">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Funil de vendas — indicador de conversão + $ parado sem pagar */}
        {metricas?.funil30d && metricas.funil30d.criados > 0 && (() => {
          const f = metricas.funil30d!
          const pct = (n: number) => (f.criados > 0 ? (n / f.criados) * 100 : 0)
          return (
            <div style={{ background: 'white', border: '1px solid #EEE', borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                  Funil de vendas <span style={{ color: '#94A3B8', fontWeight: 500 }}>· últimos 30 dias</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{f.criados} pedidos criados</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#ECFDF5', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>{f.conversao}%</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Conversão — {f.pagos} de {f.criados} pagaram</div>
                </div>
                <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', lineHeight: 1.1 }}>{formatBRL(f.valor_perdido)}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Parado sem pagar — {f.pendentes} pedidos</div>
                </div>
              </div>

              <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: '#F1F5F9' }}>
                <div style={{ width: `${pct(f.pagos)}%`, background: '#10B981' }} />
                <div style={{ width: `${pct(f.pendentes)}%`, background: '#F59E0B' }} />
                <div style={{ width: `${pct(f.cancelados)}%`, background: '#CBD5E1' }} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12, color: '#64748B' }}>
                <span><span style={{ color: '#10B981' }}>●</span> Pagos {f.pagos}</span>
                <span><span style={{ color: '#F59E0B' }}>●</span> Pendentes {f.pendentes}</span>
                <span><span style={{ color: '#CBD5E1' }}>●</span> Cancelados {f.cancelados}</span>
                <span style={{ marginLeft: 'auto', color: '#059669', fontWeight: 600 }}>Faturado: {formatBRL(f.valor_pago)}</span>
              </div>
            </div>
          )
        })()}

        {/* Filtros */}
        <div className="ap-filtros">
          <select
            value={fStatus}
            onChange={e => setFStatus(e.target.value)}
            className="ap-input"
          >
            {FILTRO_STATUS.map(s => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={fRevendedora}
            onChange={e => setFRevendedora(e.target.value)}
            className="ap-input"
          >
            <option value="">Todas revendedoras</option>
            {revendedorasFiltro.map(r => (
              <option key={r.slug} value={r.slug}>
                {r.nome}
              </option>
            ))}
          </select>

          <select
            value={fRange}
            onChange={e => setFRange(e.target.value as typeof fRange)}
            className="ap-input"
          >
            <option value="todos">Qualquer data</option>
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="custom">Personalizado</option>
          </select>

          {fRange === 'custom' && (
            <>
              <input
                type="date"
                value={fDe}
                onChange={e => setFDe(e.target.value)}
                className="ap-input"
              />
              <input
                type="date"
                value={fAte}
                onChange={e => setFAte(e.target.value)}
                className="ap-input"
              />
            </>
          )}

          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nome, email, CPF, nº pedido…"
            className="ap-input ap-input-busca"
          />

          <button onClick={limparFiltros} className="ap-btn-ghost" type="button">
            Limpar filtros
          </button>
        </div>

        {/* Tabela */}
        <div className="ap-table">
          <div className="ap-thead">
            <div>Pedido</div>
            <div>Cliente</div>
            <div>Itens</div>
            <div>Total</div>
            <div>Revendedora</div>
            <div>Status</div>
            <div></div>
          </div>

          {loading ? (
            <div className="ap-empty">
              <div style={loadingTxt}>Carregando pedidos…</div>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="ap-empty">Nenhum pedido encontrado.</div>
          ) : (
            pedidos.map(p => {
              const abandonado = isAbandonado(p.status, p.created_at)
              const sm = abandonado
                ? statusMeta('abandonado')
                : statusMeta(p.status)
              const qtd = Array.isArray(p.itens)
                ? p.itens.reduce((a, i) => a + Number(i.quantidade || 0), 0)
                : 0
              return (
                <div key={p.id} className="ap-row">
                  <div className="ap-cell" data-label="Pedido">
                    <div>
                      <div style={{ fontWeight: 700, color: '#1A1A1A' }}>
                        {p.numero_pedido}
                      </div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>
                        {formatData(p.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="ap-cell" data-label="Cliente">
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: '#1A1A1A',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.cliente_nome}
                      </div>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>
                        {p.cliente_email}
                      </div>
                    </div>
                  </div>
                  <div
                    className="ap-cell"
                    data-label="Itens"
                    title={
                      Array.isArray(p.itens)
                        ? p.itens
                            .map(i => `${i.quantidade}× ${i.nome}`)
                            .join('\n')
                        : ''
                    }
                  >
                    {qtd} {qtd === 1 ? 'item' : 'itens'}
                  </div>
                  <div
                    className="ap-cell"
                    data-label="Total"
                    style={{ fontWeight: 700, color: '#1A1A1A' }}
                  >
                    {formatBRL(p.total)}
                  </div>
                  <div
                    className="ap-cell"
                    data-label="Revendedora"
                    title={p.slug_revendedora || ''}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#64748B',
                      }}
                    >
                      {p.nome_revendedora || p.slug_revendedora || '—'}
                    </span>
                  </div>
                  <div className="ap-cell" data-label="Status">
                    <span
                      style={{
                        background: sm.bg,
                        color: sm.text,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sm.label}
                    </span>
                  </div>
                  <div className="ap-cell ap-cell-acao">
                    <button
                      onClick={() => abrirDetalhe(p.id)}
                      className="ap-btn-detalhe"
                      type="button"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Paginação */}
        {!loading && pedidos.length > 0 && (
          <div className="ap-pag">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="ap-btn-ghost"
              type="button"
            >
              ← Anterior
            </button>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="ap-btn-ghost"
              type="button"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* ---------- MODAL ---------- */}
      {modalId && (
        <div
          className="ap-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) fecharModal()
          }}
        >
          <div className="ap-modal">
            <button
              onClick={fecharModal}
              className="ap-modal-x"
              type="button"
              aria-label="Fechar"
            >
              ✕
            </button>

            {detalheLoading || !detalhe ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={loadingTxt}>Carregando…</div>
              </div>
            ) : (
              <ModalConteudo
                d={detalhe}
                acaoLoading={acaoLoading}
                obsAberta={obsAberta}
                setObsAberta={setObsAberta}
                obsTexto={obsTexto}
                setObsTexto={setObsTexto}
                histAberto={histAberto}
                setHistAberto={setHistAberto}
                onMudarStatus={mudarStatus}
                onCancelar={cancelarPedido}
                onSalvarObs={salvarObservacao}
                onCopiar={copiar}
              />
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="ap-toast"
          style={{
            background: toast.tipo === 'ok' ? '#065F46' : '#991B1B',
          }}
        >
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .ap-wrap {
          min-height: 100vh;
          background: #fafafa;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
          color: #1a1a1a;
        }
        .ap-top {
          position: sticky;
          top: 0;
          z-index: 50;
          background: white;
          border-bottom: 1px solid #eee;
        }
        .ap-top-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .ap-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ap-mark {
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
        .ap-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
        }
        .ap-sub {
          font-size: 12px;
          color: #94a3b8;
        }
        .ap-actions {
          display: flex;
          gap: 8px;
        }
        .ap-btn-ghost {
          padding: 8px 14px;
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          font-size: 13px;
          cursor: pointer;
          color: #555;
          text-decoration: none;
          font-family: inherit;
          transition: border-color 0.15s;
        }
        .ap-btn-ghost:hover {
          border-color: #1a1a1a;
          color: #1a1a1a;
        }
        .ap-btn-ghost:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ap-body {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 24px 60px;
        }
        .ap-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        .ap-metric {
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 18px;
        }
        .ap-metric-icon {
          font-size: 18px;
          margin-bottom: 10px;
        }
        .ap-metric-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.1;
        }
        .ap-metric-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
        .ap-filtros {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }
        .ap-input {
          padding: 10px 12px;
          border: 1px solid #eee;
          border-radius: 12px;
          font-size: 13px;
          font-family: inherit;
          background: white;
          color: #1a1a1a;
          outline: none;
        }
        .ap-input-busca {
          flex: 1;
          min-width: 220px;
        }
        .ap-table {
          background: white;
          border: 1px solid #eee;
          border-radius: 12px;
          overflow: hidden;
        }
        .ap-thead,
        .ap-row {
          display: grid;
          grid-template-columns: 1.3fr 1.6fr 0.8fr 0.9fr 1.2fr 1fr 1fr;
          gap: 12px;
          align-items: center;
        }
        .ap-thead {
          padding: 14px 20px;
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid #eee;
          background: #fafafa;
        }
        .ap-row {
          padding: 16px 20px;
          border-bottom: 1px solid #f3f3f3;
          font-size: 14px;
        }
        .ap-row:last-child {
          border-bottom: none;
        }
        .ap-cell {
          min-width: 0;
        }
        .ap-btn-detalhe {
          padding: 8px 14px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .ap-empty {
          padding: 60px 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
        }
        .ap-pag {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 20px;
        }
        .ap-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 15, 15, 0.45);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 40px 16px;
          overflow-y: auto;
          animation: ap-fade 0.18s ease-out;
        }
        .ap-modal {
          position: relative;
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 720px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 32px;
          animation: ap-pop 0.2s ease-out;
        }
        .ap-modal-x {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid #eee;
          background: white;
          cursor: pointer;
          font-size: 14px;
          color: #555;
          z-index: 2;
        }
        .ap-toast {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 200;
          color: white;
          padding: 12px 22px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          animation: ap-fade 0.18s ease-out;
        }
        @keyframes ap-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes ap-pop {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (max-width: 1100px) {
          .ap-metrics {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 860px) {
          .ap-thead {
            display: none;
          }
          .ap-row {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 16px;
          }
          .ap-cell {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .ap-cell::before {
            content: attr(data-label);
            color: #94a3b8;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .ap-cell-acao::before {
            content: none;
          }
          .ap-cell-acao {
            justify-content: stretch;
          }
          .ap-btn-detalhe {
            width: 100%;
          }
        }
        @media (max-width: 560px) {
          .ap-metrics {
            grid-template-columns: 1fr;
          }
          .ap-modal {
            padding: 22px;
          }
        }
      `}</style>
    </div>
  )
}

// ---------------- Conteúdo do modal ----------------
function ModalConteudo({
  d,
  acaoLoading,
  obsAberta,
  setObsAberta,
  obsTexto,
  setObsTexto,
  histAberto,
  setHistAberto,
  onMudarStatus,
  onCancelar,
  onSalvarObs,
  onCopiar,
}: {
  d: Detalhe
  acaoLoading: boolean
  obsAberta: boolean
  setObsAberta: (v: boolean) => void
  obsTexto: string
  setObsTexto: (v: string) => void
  histAberto: boolean
  setHistAberto: (v: boolean) => void
  onMudarStatus: (s: string) => void
  onCancelar: () => void
  onSalvarObs: () => void
  onCopiar: (t: string, m: string) => void
}) {
  const abandonado = isAbandonado(d.status, d.created_at)
  const sm = abandonado ? statusMeta('abandonado') : statusMeta(d.status)
  const outros = STATUS_FLUXO.filter(s => s !== d.status)

  const comissaoPrevista = Number(d.subtotal || 0) * 0.3

  const labelCard: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  }
  const card: React.CSSProperties = {
    border: '1px solid #EEE',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  }
  const linhaVal: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  }

  const enderecoCompleto = `${d.cliente_nome}
${d.endereco_rua}, ${d.endereco_numero}${
    d.endereco_complemento ? ` — ${d.endereco_complemento}` : ''
  }
${d.endereco_bairro}
${d.endereco_cidade} — ${d.endereco_uf}
CEP ${maskCEP(d.endereco_cep)}`

  const dadosCliente = `Nome: ${d.cliente_nome}
Email: ${d.cliente_email}
CPF: ${maskCPF(d.cliente_cpf)}
Telefone: ${maskTelefone(d.cliente_telefone)}`

  const totalItens = Array.isArray(d.itens)
    ? d.itens.reduce((a, i) => a + Number(i.quantidade || 0), 0)
    : 0

  const waLink = d.revendedora?.whatsapp
    ? `https://wa.me/55${d.revendedora.whatsapp.replace(/\D/g, '')}`
    : null

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: 20, paddingRight: 32 }}>
        <div
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 24,
            fontWeight: 700,
            color: '#1A1A1A',
          }}
        >
          {d.numero_pedido}
        </div>
        <div style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 10px' }}>
          Criado em {formatData(d.created_at, true)} · {tempoRelativo(d.created_at)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              background: sm.bg,
              color: sm.text,
              fontSize: 13,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 999,
            }}
          >
            {sm.label}
          </span>
          {/* Botão imprimir — só faz sentido a partir de pago */}
          {['pago', 'enviado', 'entregue'].includes(d.status) && (
            <a
              href={`/admin/pedidos/${d.id}/imprimir`}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                background: '#0F172A',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                padding: '7px 16px',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              🖨️ Imprimir pedido
            </a>
          )}
        </div>
      </div>

      {/* CLIENTE */}
      <div style={card}>
        <div style={labelCard}>Cliente</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#444' }}>
          <div style={{ fontWeight: 600, color: '#1A1A1A' }}>
            {d.cliente_nome}
          </div>
          <div>
            <a href={`mailto:${d.cliente_email}`} style={linkStyle}>
              {d.cliente_email}
            </a>
          </div>
          <div>CPF: {maskCPF(d.cliente_cpf)}</div>
          <div>
            <a
              href={`https://wa.me/55${d.cliente_telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              {maskTelefone(d.cliente_telefone)}
            </a>
          </div>
        </div>
        <button
          onClick={() => onCopiar(dadosCliente, 'Dados do cliente copiados')}
          style={btnCopiar}
          type="button"
        >
          Copiar dados do cliente
        </button>
      </div>

      {/* ENDEREÇO */}
      <div style={card}>
        <div style={labelCard}>Endereço de entrega</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: '#444' }}>
          <div>
            {d.endereco_rua}, {d.endereco_numero}
            {d.endereco_complemento ? ` — ${d.endereco_complemento}` : ''}
          </div>
          <div>{d.endereco_bairro}</div>
          <div>
            {d.endereco_cidade} — {d.endereco_uf}
          </div>
          <div>CEP {maskCEP(d.endereco_cep)}</div>
        </div>
        <button
          onClick={() => onCopiar(enderecoCompleto, 'Endereço copiado')}
          style={btnCopiar}
          type="button"
        >
          Copiar endereço completo
        </button>
      </div>

      {/* ITENS */}
      <div style={card}>
        <div style={labelCard}>Itens ({totalItens})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(d.itens || []).map((it, i) => (
            <div
              key={`${it.id}-${i}`}
              style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  background: '#F5F5F5',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {it.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.foto}
                    alt={it.nome}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    💎
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                  {it.nome}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  SKU {it.sku} · {it.quantidade} × {formatBRL(it.preco)}
                </div>
                {it.variacao && (
                  <div style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 600, marginTop: 2 }}>
                    {it.variacao}{it.ref ? ` · Ref ${it.ref}` : ''}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                {formatBRL(it.preco * it.quantidade)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VALORES */}
      <div style={card}>
        <div style={labelCard}>Valores</div>
        <div style={linhaVal}>
          <span>Subtotal</span>
          <span>{formatBRL(d.subtotal)}</span>
        </div>
        <div style={linhaVal}>
          <span>Frete</span>
          {Number(d.frete) === 0 ? (
            <span style={{ color: '#15803D', fontWeight: 700 }}>Grátis</span>
          ) : (
            <span>{formatBRL(d.frete)}</span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: '1px solid #EEE',
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>
            {formatBRL(d.total)}
          </span>
        </div>
      </div>

      {/* REVENDEDORA */}
      {d.slug_revendedora && (
        <div style={card}>
          <div style={labelCard}>Revendedora</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#444' }}>
            <div style={{ fontWeight: 600, color: '#1A1A1A' }}>
              {d.revendedora?.nome_loja ||
                d.revendedora?.nome ||
                d.slug_revendedora}
            </div>
            {waLink && (
              <div>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  {maskTelefone(d.revendedora!.whatsapp)}
                </a>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              Comissão prevista:{' '}
              <strong style={{ color: '#1A1A1A' }}>
                {formatBRL(comissaoPrevista)}
              </strong>{' '}
              <span style={{ color: '#94A3B8' }}>
                (30% sobre {formatBRL(d.subtotal)} subtotal)
              </span>
            </div>
            {d.comissao && (
              <div style={{ marginTop: 6 }}>
                Status da comissão:{' '}
                <span
                  style={{
                    background:
                      COMISSAO_META[d.comissao.status]?.bg || '#F5F5F5',
                    color:
                      COMISSAO_META[d.comissao.status]?.text || '#64748B',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                  }}
                >
                  {COMISSAO_META[d.comissao.status]?.label ||
                    d.comissao.status}
                </span>
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#94A3B8',
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            Comissão é liberada automaticamente quando o pedido é marcado como
            pago.
          </div>
        </div>
      )}

      {/* AÇÕES */}
      <div style={{ ...card, background: '#FAFAFA' }}>
        <div style={labelCard}>Ações</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {outros.map(s => (
            <button
              key={s}
              onClick={() => (s === 'cancelado' ? onCancelar() : onMudarStatus(s))}
              disabled={acaoLoading}
              style={{ ...btnAcao, background: statusMeta(s).text }}
              type="button"
            >
              {s === 'cancelado'
                ? '✕ Cancelar pedido'
                : `→ Marcar como ${statusMeta(s).label}`}
            </button>
          ))}
          <button
            onClick={() => setObsAberta(!obsAberta)}
            disabled={acaoLoading}
            style={{
              ...btnAcao,
              background: 'white',
              color: '#1A1A1A',
              border: '1px solid #1A1A1A',
            }}
            type="button"
          >
            + Adicionar observação
          </button>
        </div>

        {obsAberta && (
          <div style={{ marginTop: 14 }}>
            <textarea
              value={obsTexto}
              onChange={e => setObsTexto(e.target.value)}
              placeholder="Escreva a observação…"
              rows={3}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #EEE',
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
            <button
              onClick={onSalvarObs}
              disabled={acaoLoading || !obsTexto.trim()}
              style={{
                ...btnAcao,
                background: '#1A1A1A',
                marginTop: 8,
                opacity: acaoLoading || !obsTexto.trim() ? 0.5 : 1,
              }}
              type="button"
            >
              {acaoLoading ? 'Salvando…' : 'Salvar observação'}
            </button>
          </div>
        )}

        {d.observacoes && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: 'white',
              border: '1px solid #EEE',
              borderRadius: 12,
              fontSize: 13,
              color: '#555',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {d.observacoes}
          </div>
        )}
      </div>

      {/* HISTÓRICO */}
      <div style={card}>
        <button
          onClick={() => setHistAberto(!histAberto)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
          type="button"
        >
          <span style={{ ...labelCard, marginBottom: 0 }}>
            Histórico ({d.historico.length})
          </span>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>
            {histAberto ? '▲' : '▼'}
          </span>
        </button>

        {histAberto && (
          <div style={{ marginTop: 14 }}>
            {d.historico.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94A3B8' }}>
                Sem registros.
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {d.historico.map(h => {
                  const soObs = h.status_anterior === h.status_novo
                  return (
                    <div
                      key={h.id}
                      style={{
                        borderLeft: '2px solid #EEE',
                        paddingLeft: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>
                        {formatData(h.created_at, true)}
                      </div>
                      <div style={{ fontSize: 13, color: '#1A1A1A' }}>
                        {soObs ? (
                          'Observação adicionada'
                        ) : (
                          <>
                            Status:{' '}
                            {statusMeta(h.status_anterior || '').label} →{' '}
                            <strong>{statusMeta(h.status_novo).label}</strong>
                          </>
                        )}
                      </div>
                      {h.observacao && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#64748B',
                            marginTop: 2,
                          }}
                        >
                          {h.observacao}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Estilos compartidos ----------------
const loadingWrap: React.CSSProperties = {
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
const linkStyle: React.CSSProperties = {
  color: '#1E40AF',
  textDecoration: 'none',
}
const btnCopiar: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 14px',
  background: 'white',
  border: '1px solid #EEE',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 600,
  color: '#1A1A1A',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnAcao: React.CSSProperties = {
  padding: '10px 16px',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
