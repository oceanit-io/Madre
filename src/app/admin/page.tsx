'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AtualizarBtn from '@/components/admin/AtualizarBtn'

// Mapa quem → nome de exibição + cor. Usado na saudação personalizada
// do hero e em qualquer lugar que precise identificar a pessoa logada.
const QUEM_LABEL: Record<string, { nome: string; cor: string }> = {
  gabby: { nome: 'Gabby', cor: '#E8396A' },
  anderson: { nome: 'Anderson', cor: '#6366F1' },
  escritorio: { nome: 'Escritório', cor: '#22C55E' },
  master: { nome: 'Admin', cor: '#9333EA' },
}

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function AdminHomePage() {
  const [autenticado, setAutenticado] = useState(false)
  const [checandoAuth, setChecandoAuth] = useState(true)
  const [pinInput, setPinInput] = useState('')
  const [erroPin, setErroPin] = useState('')
  // "Lembrar PIN neste dispositivo" — salva o PIN em localStorage.
  // Trade-off: conforto (não precisa digitar toda vez) vs segurança
  // (qualquer um com acesso ao browser dela vê o PIN). Pra computador
  // pessoal da Gabriela é aceitável.
  const [lembrarPin, setLembrarPin] = useState(false)

  // Auto-preenche PIN salvo (se ela marcou lembrar antes)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_pin_lembrado')
      if (saved) {
        setPinInput(saved)
        setLembrarPin(true)
      }
    } catch { /* */ }
  }, [])

  // Quem é o admin logado (gabby/anderson/escritorio/master). Mostra
  // saudação personalizada no hero. Buscado após auth confirmar.
  const [quem, setQuem] = useState<string | null>(null)

  // Alertas não-lidos (banner vermelho no topo)
  const [alertasNaoLidas, setAlertasNaoLidas] = useState(0)

  const [stats, setStats] = useState({
    totalRevendedoras: 0,
    revendedorasAtivas: 0,
    revendedorasPendentes: 0,
    vendasMes: 0,
    receitaMes: 0,
    saldoPendente: 0,
    saquesPendentesCount: 0,
    saquesPendentesValor: 0,
    saquesAtrasados: 0,
    comissoesVencidas: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null)
  const [pedidoMetricas, setPedidoMetricas] = useState<{
    vendas_hoje: number
    pedidos_hoje: number
  } | null>(null)
  const [pedHover, setPedHover] = useState(false)

  // Verifica auth al cargar — pergunta ao server se o cookie HttpOnly
  // ainda é válido. PIN nunca volta pro client.
  useEffect(() => {
    let cancelado = false
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancelado) return
        if (d?.autenticado) {
          sessionStorage.setItem('admin_auth', 'ok')
          setAutenticado(true)
        } else {
          sessionStorage.removeItem('admin_auth')
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelado) setChecandoAuth(false) })
    return () => { cancelado = true }
  }, [])

  // Busca QUEM tá logado pra mostrar saudação. Roda quando autenticado.
  useEffect(() => {
    if (!autenticado) { setQuem(null); return }
    fetch('/api/admin/me', { cache: 'no-store', credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setQuem(d?.quem || null))
      .catch(() => setQuem(null))
  }, [autenticado])

  // Conta alertas não-lidos pra mostrar banner. Refresh a cada 60s.
  useEffect(() => {
    if (!autenticado) { setAlertasNaoLidas(0); return }
    let cancelado = false
    const fetchCount = () => {
      fetch('/api/admin/alertas?count=1', { cache: 'no-store', credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (!cancelado) setAlertasNaoLidas(d?.nao_lidas || 0) })
        .catch(() => { /* */ })
    }
    fetchCount()
    const t = setInterval(fetchCount, 60_000)
    return () => { cancelado = true; clearInterval(t) }
  }, [autenticado])

  async function carregarPainel() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/stats', {
        headers: {},
        cache: 'no-store',
      })
      if (res.ok) setStats(await res.json())
    } catch (e) {
      console.error('Erro ao carregar stats:', e)
    }
    try {
      const resM = await fetch('/api/admin/metricas', {
        headers: {},
        cache: 'no-store',
      })
      if (resM.ok) setPedidoMetricas(await resM.json())
    } catch (e) {
      console.error('Erro ao carregar métricas de pedidos:', e)
    }
    setLoading(false)
    setRefreshing(false)
    setUltimaAtualizacao(Date.now())
  }

  // Carga stats solo si está autenticado
  useEffect(() => {
    if (!autenticado) return
    carregarPainel()
  }, [autenticado])

  async function entrarComPin(e: React.FormEvent) {
    e.preventDefault()
    setErroPin('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      if (res.ok) {
        sessionStorage.setItem('admin_auth', 'ok')
        // Salva/remove PIN salvo conforme escolha
        try {
          if (lembrarPin) localStorage.setItem('admin_pin_lembrado', pinInput)
          else localStorage.removeItem('admin_pin_lembrado')
        } catch { /* */ }
        setAutenticado(true)
        // NÃO limpa pinInput se ela quer lembrar (pra UI consistente)
        if (!lembrarPin) setPinInput('')
      } else {
        setErroPin('PIN incorreto')
        // Se PIN salvo deu errado (ex: tu trocou o PIN), limpa
        try { localStorage.removeItem('admin_pin_lembrado') } catch { /* */ }
        setPinInput('')
      }
    } catch {
      setErroPin('Erro de conexão')
    }
  }

  async function fazerLogout() {
    try {
      await fetch('/api/admin/login', { method: 'DELETE' })
    } catch { /* */ }
    try {
      sessionStorage.removeItem('admin_auth')
      sessionStorage.clear()
      localStorage.removeItem('admin_auth')
      // Logout explícito limpa PIN salvo também — segurança
      localStorage.removeItem('admin_pin_lembrado')
    } catch (e) {
      console.error('Erro ao limpar storage:', e)
    }
    setLembrarPin(false)
    setAutenticado(false)
    setPinInput('')
    setStats({
      totalRevendedoras: 0,
      revendedorasAtivas: 0,
      revendedorasPendentes: 0,
      vendasMes: 0,
      receitaMes: 0,
      saldoPendente: 0,
      saquesPendentesCount: 0,
      saquesPendentesValor: 0,
      saquesAtrasados: 0,
      comissoesVencidas: 0,
    })
  }

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatNum(n: number) {
    return n.toLocaleString('pt-BR')
  }

  // Estado: verificando auth
  if (checandoAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#FAFAFA' }}>
        <div style={{ fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Carregando</div>
      </div>
    )
  }

  // Estado: no autenticado → mostrar form de PIN
  if (!autenticado) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAFAFA',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif',
        padding: 20,
      }}>
        <div style={{
          background: 'white',
          border: '1px solid #EFEFEF',
          borderRadius: 16,
          padding: 40,
          width: '100%',
          maxWidth: 380,
          textAlign: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#1A1A1A',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: .5,
          }}>925</div>

          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#E8396A',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 8,
          }}>Backoffice</div>

          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#1A1A1A',
            marginBottom: 8,
            margin: '0 0 8px',
          }}>Área restrita</h1>

          <p style={{
            fontSize: 13,
            color: '#64748B',
            marginBottom: 28,
            margin: '0 0 28px',
          }}>Digite o PIN para acessar</p>

          <form onSubmit={entrarComPin}>
            <input
              type="password"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setErroPin('') }}
              placeholder="PIN"
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 15,
                border: '1px solid',
                borderColor: erroPin ? '#DC2626' : '#E5E5E5',
                borderRadius: 10,
                outline: 'none',
                textAlign: 'center',
                letterSpacing: 4,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                marginBottom: erroPin ? 8 : 16,
              }}
            />

            {erroPin && (
              <div style={{
                fontSize: 12,
                color: '#DC2626',
                marginBottom: 16,
                fontWeight: 500,
              }}>{erroPin}</div>
            )}

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              cursor: 'pointer',
              fontSize: 13,
              color: '#475569',
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={lembrarPin}
                onChange={e => setLembrarPin(e.target.checked)}
                style={{ accentColor: '#1A1A1A', width: 16, height: 16, cursor: 'pointer' }}
              />
              Lembrar PIN neste dispositivo
            </label>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: '#1A1A1A',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Estado: cargando stats
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 13, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Carregando</div>
      </div>
    )
  }

  const metricas = [
    {
      label: 'Revendedoras',
      sub: 'cadastradas',
      val: formatNum(stats.totalRevendedoras),
      delta: `${stats.revendedorasAtivas} ativas`,
      deltaType: 'neutral',
      href: '/admin/revendedoras',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    {
      label: 'Vendas',
      sub: 'este mês',
      val: formatNum(stats.vendasMes),
      delta: stats.vendasMes > 0 ? 'Em progresso' : 'Sem vendas',
      deltaType: stats.vendasMes > 0 ? 'positive' : 'neutral',
      href: '/admin/vendas',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      )
    },
    {
      label: 'Receita',
      sub: 'este mês',
      val: formatBRL(stats.receitaMes),
      delta: 'Vendas pagas',
      deltaType: 'neutral',
      href: '/admin/financeiro',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      )
    },
    {
      label: 'Comissões',
      sub: 'a pagar',
      val: formatBRL(stats.saldoPendente),
      delta: 'Pendente',
      deltaType: 'warning',
      href: '/admin/saldos',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      )
    },
  ]

  const catalogoManual = process.env.NEXT_PUBLIC_BRAND_CATALOGO === 'manual'

  const secoes = [
    ...(catalogoManual ? [{
      label: 'Produtos',
      href: '/admin/produtos',
      desc: 'Cadastrar, editar e gerenciar o catálogo de produtos',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      )
    }] : []),
    {
      label: 'Baixa Tray',
      href: '/admin/relatorio-tray',
      desc: 'Vendas a abater no estoque da Tray',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
        </svg>
      )
    },
    {
      label: 'Gráficos',
      href: '/admin/graficos',
      desc: 'Faturamento, status, top revendedoras, mensalidades',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      )
    },
    {
      label: 'Financeiro',
      href: '/admin/financeiro',
      desc: 'Faturado, comissões e líquido do negócio',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      )
    },
    {
      label: 'Destaques',
      href: '/admin/destaques',
      desc: 'Marque as peças mais lindas p/ a loja',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      )
    },
    {
      label: 'Ativar pendentes',
      href: '/admin/ativar',
      desc: stats.revendedorasPendentes > 0
        ? `${stats.revendedorasPendentes} aguardando ativação`
        : 'Nenhuma pendente no momento',
      destaque: stats.revendedorasPendentes > 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      )
    },
    {
      label: 'Revendedoras',
      href: '/admin/revendedoras',
      desc: 'Lista completa com busca e filtros por status',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/>
          <line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
      )
    },
    {
      label: 'Vendas',
      href: '/admin/vendas',
      desc: 'Histórico de vendas por revendedora',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      )
    },
    {
      label: 'Saldos',
      href: '/admin/saldos',
      desc: 'Pagamentos pendentes e histórico',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      )
    },
    {
      label: 'Saques',
      href: '/admin/saques',
      desc: stats.saquesPendentesCount > 0
        ? `💸 ${stats.saquesPendentesCount} aguardando pagamento — ${stats.saquesPendentesValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
        : 'Aprovar e marcar saques como pagos',
      destaque: stats.saquesPendentesCount > 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      )
    },
    {
      label: 'Visitas',
      href: '/admin/visitas',
      desc: 'Tráfego landing + cadastro, funil de conversão',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/>
          <path d="M7 17V13"/>
          <path d="M12 17V9"/>
          <path d="M17 17V5"/>
        </svg>
      )
    },
    {
      label: 'Mapa de cadastros',
      href: '/admin/mapa',
      desc: 'Revendedoras por estado do Brasil',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/>
          <line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
      )
    },
    {
      label: 'Mensalidades',
      href: '/admin/mensalidades',
      desc: 'Status de pagamento mensal',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )
    },
    {
      label: 'Alertas',
      href: '/admin/alertas',
      desc: alertasNaoLidas > 0
        ? `${alertasNaoLidas} ${alertasNaoLidas === 1 ? 'pagamento recebido' : 'pagamentos recebidos'} aguardando ativação`
        : 'Pagamentos e avisos do sistema',
      destaque: alertasNaoLidas > 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      )
    },
    {
      label: 'Auditoria',
      href: '/admin/audit-log',
      desc: 'Quem fez o quê e quando',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4"/>
          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3z" transform="translate(-9 0)"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      )
    },
  ]

  return (
    <div className="bo-wrap">
      <header className="bo-top">
        <div className="bo-brand">
          <div className="bo-brand-mark">925</div>
          <div>
            <div className="bo-brand-name">Prata 925</div>
            <div className="bo-brand-sub">Backoffice administrativo</div>
            <div className="bo-brand-source">
              <span>by</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/logo-p15.png" alt="Prata de 15 Reais" />
            </div>
          </div>
        </div>
        <button onClick={fazerLogout} className="bo-logout" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </header>

      <div className="bo-hero" style={{ position: 'relative' }}>
        {(() => {
          const info = QUEM_LABEL[quem || '']
          if (info) {
            return (
              <>
                <div
                  className="bo-greeting"
                  style={{
                    color: info.cor,
                    background: `${info.cor}12`,
                    borderColor: `${info.cor}40`,
                  }}
                >
                  {saudacao()}, <strong>{info.nome}</strong> 👋
                </div>
                <div className="bo-title">Painel de controle</div>
              </>
            )
          }
          return (
            <>
              <div className="bo-eyebrow">Visão geral</div>
              <div className="bo-title">Painel de controle</div>
            </>
          )
        })()}
        <div className="bo-sub">Acompanhe o desempenho das revendedoras em tempo real</div>
        <div style={{ position: 'absolute', top: 0, right: 0 }}>
          <AtualizarBtn
            onClick={carregarPainel}
            loading={refreshing}
            ultimaAtualizacao={ultimaAtualizacao}
          />
        </div>
      </div>

      {alertasNaoLidas > 0 && (
        <a href="/admin/alertas" className="bo-alert" style={{ background: '#FEF2F2', borderColor: '#FCA5A5', marginBottom: 12 }}>
          <div className="bo-alert-icon" style={{ background: '#DC2626' }}>💰</div>
          <div className="bo-alert-content">
            <div className="bo-alert-title" style={{ color: '#991B1B' }}>
              {alertasNaoLidas} {alertasNaoLidas === 1 ? 'pagamento recebido aguarda' : 'pagamentos recebidos aguardam'} ativação manual
            </div>
            <div className="bo-alert-desc" style={{ color: '#B91C1C' }}>
              InfinitePay confirmou pagamento mas o sistema não conseguiu casar com revendedora. Clica e ativa →
            </div>
          </div>
          <div className="bo-alert-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </a>
      )}

      {stats.saquesPendentesCount > 0 && (
        <a href="/admin/saques" className="bo-alert" style={{
          background: stats.saquesAtrasados > 0 ? '#FFFBEB' : '#FEFCE8',
          borderColor: stats.saquesAtrasados > 0 ? '#FCD34D' : '#FDE68A',
          marginBottom: 12,
        }}>
          <div className="bo-alert-icon" style={{ background: stats.saquesAtrasados > 0 ? '#D97706' : '#CA8A04' }}>💸</div>
          <div className="bo-alert-content">
            <div className="bo-alert-title" style={{ color: '#92400E' }}>
              {stats.saquesPendentesCount} {stats.saquesPendentesCount === 1 ? 'saque aguarda pagamento' : 'saques aguardam pagamento'}
              {' '}— total {stats.saquesPendentesValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div className="bo-alert-desc" style={{ color: '#B45309' }}>
              {stats.saquesAtrasados > 0
                ? `⚠️ ${stats.saquesAtrasados} ${stats.saquesAtrasados === 1 ? 'saque atrasado' : 'saques atrasados'} (+ 48h). Paga as revendedoras agora.`
                : 'Revendedoras esperando você liberar o PIX. Clique pra ver →'}
            </div>
          </div>
          <div className="bo-alert-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </a>
      )}

      {stats.revendedorasPendentes > 0 && (
        <a href="/admin/ativar" className="bo-alert">
          <div className="bo-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="bo-alert-content">
            <div className="bo-alert-title">
              {stats.revendedorasPendentes} {stats.revendedorasPendentes === 1 ? 'revendedora aguarda' : 'revendedoras aguardam'} ativação
            </div>
            <div className="bo-alert-desc">Verifique o pagamento e ative as contas →</div>
          </div>
          <div className="bo-alert-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </a>
      )}

      <div className="bo-metrics">
        {metricas.map((m, i) => (
          <Link key={i} href={m.href} className="bo-metric" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div className="bo-metric-head">
              <div className="bo-metric-icon">{m.icon}</div>
              <div className="bo-metric-sub">{m.sub}</div>
            </div>
            <div className="bo-metric-label">{m.label}</div>
            <div className="bo-metric-val">{m.val}</div>
            <div className={`bo-delta bo-delta-${m.deltaType}`}>{m.delta}</div>
          </Link>
        ))}
      </div>

      <Link
        href="/admin/pedidos"
        onMouseEnter={() => setPedHover(true)}
        onMouseLeave={() => setPedHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          padding: '24px 28px',
          background: 'white',
          border: `1px solid ${pedHover ? '#1A1A1A' : '#EFEFEF'}`,
          borderRadius: 12,
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 40,
          transition: 'border-color .15s, transform .15s',
          transform: pedHover ? 'translateX(2px)' : 'none',
        }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#E8396A', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            Loja · Checkout
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
            Pedidos
          </div>
          <div style={{ fontSize: 13, color: '#777' }}>
            Gerencie pedidos, status e comissões
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.1 }}>
              {pedidoMetricas ? formatNum(pedidoMetricas.pedidos_hoje) : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Pedidos hoje</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.1 }}>
              {pedidoMetricas ? formatBRL(pedidoMetricas.vendas_hoje) : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Vendas hoje</div>
          </div>
        </div>
        <div style={{ fontSize: 20, color: pedHover ? '#1A1A1A' : '#CBD5E1', flexShrink: 0, transition: 'color .15s' }}>
          →
        </div>
      </Link>

      <div className="bo-section-head">
        <div className="bo-section-title">Gestão</div>
        <div className="bo-section-sub">Acesse as áreas administrativas</div>
      </div>

      <div className="bo-sections">
        {secoes.map((s, i) => (
          <a key={i} href={s.href} className={`bo-section ${s.destaque ? 'bo-section-destaque' : ''}`}>
            <div className="bo-section-icon">{s.icon}</div>
            <div className="bo-section-content">
              <div className="bo-section-label">{s.label}</div>
              <div className="bo-section-desc">{s.desc}</div>
            </div>
            <div className="bo-section-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </a>
        ))}
      </div>

      <style jsx>{`
        .bo-wrap {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 40px 56px 56px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 0% 0%, rgba(232,57,106,.1) 0, transparent 35%),
            radial-gradient(circle at 100% 0%, rgba(99,102,241,.1) 0, transparent 35%),
            radial-gradient(circle at 100% 100%, rgba(16,185,129,.06) 0, transparent 40%),
            linear-gradient(180deg, #FDFBFE 0%, #F8FAFD 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        }
        .bo-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 24px;
          border-bottom: 1px solid #E8ECF1;
          margin-bottom: 40px;
        }
        .bo-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .bo-brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #E8396A 0%, #C026D3 50%, #6366F1 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Montserrat', sans-serif;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: .8px;
          box-shadow: 0 6px 16px rgba(192,38,211,.35), inset 0 1px 0 rgba(255,255,255,.2);
        }
        .bo-brand-name {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.2;
          letter-spacing: -.1px;
        }
        .bo-brand-sub {
          font-size: 11px;
          color: #94A3B8;
          margin-top: 2px;
          font-weight: 500;
          letter-spacing: .3px;
        }
        .bo-brand-source {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 3px 9px 3px 7px;
          background: linear-gradient(135deg, #FDE8EE 0%, #FCD9E4 100%);
          border-radius: 999px;
          border: 1px solid #F4C0D1;
          font-family: 'Montserrat', sans-serif;
          font-size: 9.5px;
          font-weight: 700;
          color: #C95E91;
          text-transform: uppercase;
          letter-spacing: .8px;
        }
        .bo-brand-source img {
          height: 14px;
          width: auto;
          object-fit: contain;
          opacity: .9;
        }
        .bo-logout {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: #475569;
          transition: all .18s;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
        }
        .bo-logout:hover {
          border-color: #DC2626;
          color: #DC2626;
          background: #FEF2F2;
          box-shadow: 0 2px 6px rgba(220,38,38,.1);
        }
        .bo-hero {
          margin-bottom: 28px;
        }
        .bo-eyebrow {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px;
          font-weight: 800;
          color: #E8396A;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(232,57,106,.08);
          border-radius: 20px;
        }
        .bo-greeting {
          font-family: 'Montserrat', sans-serif;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -.2px;
          margin-bottom: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid;
          border-radius: 999px;
        }
        .bo-greeting strong {
          font-weight: 800;
        }
        .bo-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 34px;
          font-weight: 800;
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #E8396A 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -1px;
          margin-bottom: 8px;
          line-height: 1.1;
        }
        .bo-sub {
          font-size: 14px;
          color: #64748B;
          font-weight: 500;
        }
        .bo-alert {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 22px;
          background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
          border: 1px solid #FCD34D;
          border-left: 4px solid #F59E0B;
          border-radius: 14px;
          text-decoration: none;
          color: inherit;
          margin-bottom: 32px;
          transition: all .2s;
          box-shadow: 0 2px 6px rgba(245,158,11,.08);
        }
        .bo-alert:hover {
          border-color: #D97706;
          border-left-color: #B45309;
          transform: translateX(3px);
          box-shadow: 0 6px 16px rgba(245,158,11,.15);
        }
        .bo-alert-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%);
          color: #78350F;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(245,158,11,.25);
        }
        .bo-alert-content {
          flex: 1;
        }
        .bo-alert-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          font-weight: 800;
          color: #78350F;
          margin-bottom: 3px;
        }
        .bo-alert-desc {
          font-size: 12.5px;
          color: #92400E;
          font-weight: 500;
        }
        .bo-alert-arrow {
          color: #92400E;
          flex-shrink: 0;
        }
        .bo-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 48px;
        }
        .bo-metric {
          background: white;
          padding: 24px;
          border-radius: 14px;
          border: 1px solid #E8ECF1;
          transition: all .2s;
          box-shadow: 0 1px 3px rgba(15,23,42,.04);
          position: relative;
          overflow: hidden;
        }
        .bo-metric::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, transparent);
          transition: background .25s;
        }
        .bo-metric:nth-child(1)::before { background: linear-gradient(90deg, #E8396A, #F472B6); }
        .bo-metric:nth-child(2)::before { background: linear-gradient(90deg, #6366F1, #8B5CF6); }
        .bo-metric:nth-child(3)::before { background: linear-gradient(90deg, #059669, #10B981); }
        .bo-metric:nth-child(4)::before { background: linear-gradient(90deg, #F59E0B, #FBBF24); }
        .bo-metric:hover {
          border-color: #CBD5E1;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15,23,42,.08);
        }
        .bo-metric-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .bo-metric-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #F1F5F9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .2s;
        }
        .bo-metric:nth-child(1) .bo-metric-icon { background: #FDF2F8; color: #E8396A; }
        .bo-metric:nth-child(2) .bo-metric-icon { background: #EEF2FF; color: #6366F1; }
        .bo-metric:nth-child(3) .bo-metric-icon { background: #ECFDF5; color: #059669; }
        .bo-metric:nth-child(4) .bo-metric-icon { background: #FFFBEB; color: #F59E0B; }
        .bo-metric-sub {
          font-family: 'Montserrat', sans-serif;
          font-size: 10.5px;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: .8px;
          font-weight: 700;
        }
        .bo-metric-label {
          font-size: 13px;
          color: #64748B;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .bo-metric-val {
          font-family: 'Montserrat', sans-serif;
          font-size: 30px;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: -.8px;
          margin-bottom: 12px;
          line-height: 1;
        }
        .bo-delta {
          font-size: 11.5px;
          font-weight: 700;
          display: inline-block;
          padding: 4px 11px;
          border-radius: 20px;
          letter-spacing: .2px;
        }
        .bo-delta-positive { background: #ECFDF5; color: #059669; }
        .bo-delta-warning { background: #FFFBEB; color: #D97706; }
        .bo-delta-neutral { background: #F1F5F9; color: #64748B; }
        .bo-section-head { margin-bottom: 22px; }
        .bo-section-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 19px;
          font-weight: 800;
          color: #0F172A;
          margin-bottom: 4px;
          letter-spacing: -.3px;
        }
        .bo-section-sub {
          font-size: 13px;
          color: #94A3B8;
          font-weight: 500;
        }
        .bo-sections {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .bo-section {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: white;
          border: 1px solid #E8ECF1;
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: all .2s;
          box-shadow: 0 1px 3px rgba(15,23,42,.03);
        }
        .bo-section:hover {
          border-color: #6366F1;
          transform: translateX(3px);
          box-shadow: 0 4px 12px rgba(99,102,241,.1);
        }
        .bo-section-destaque {
          border-color: #FCD34D;
          background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
          border-left: 4px solid #F59E0B;
        }
        .bo-section-destaque .bo-section-icon {
          background: linear-gradient(135deg, #FCD34D, #F59E0B);
          color: #78350F;
        }
        .bo-section-destaque:hover {
          border-color: #D97706;
          box-shadow: 0 4px 12px rgba(245,158,11,.15);
        }
        .bo-section-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: #F1F5F9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all .25s;
        }
        /* Cada seção ganha cor própria (cycle de 5) — paleta profissional */
        .bo-section:nth-child(5n+1) .bo-section-icon { background: #FDF2F8; color: #E8396A; }
        .bo-section:nth-child(5n+2) .bo-section-icon { background: #EEF2FF; color: #6366F1; }
        .bo-section:nth-child(5n+3) .bo-section-icon { background: #ECFDF5; color: #059669; }
        .bo-section:nth-child(5n+4) .bo-section-icon { background: #FFFBEB; color: #F59E0B; }
        .bo-section:nth-child(5n) .bo-section-icon { background: #EFF6FF; color: #2563EB; }
        /* Hover intensifica a cor própria do card */
        .bo-section:nth-child(5n+1):hover { border-color: #E8396A; box-shadow: 0 6px 16px rgba(232,57,106,.15); }
        .bo-section:nth-child(5n+2):hover { border-color: #6366F1; box-shadow: 0 6px 16px rgba(99,102,241,.15); }
        .bo-section:nth-child(5n+3):hover { border-color: #059669; box-shadow: 0 6px 16px rgba(5,150,105,.15); }
        .bo-section:nth-child(5n+4):hover { border-color: #F59E0B; box-shadow: 0 6px 16px rgba(245,158,11,.15); }
        .bo-section:nth-child(5n):hover   { border-color: #2563EB; box-shadow: 0 6px 16px rgba(37,99,235,.15); }
        .bo-section:hover .bo-section-icon {
          transform: scale(1.08);
        }
        /* Destaque (Ativar pendentes) sobrescreve a cor cycle */
        .bo-section-destaque .bo-section-icon,
        .bo-section.bo-section-destaque:nth-child(5n+1) .bo-section-icon,
        .bo-section.bo-section-destaque:nth-child(5n+2) .bo-section-icon,
        .bo-section.bo-section-destaque:nth-child(5n+3) .bo-section-icon,
        .bo-section.bo-section-destaque:nth-child(5n+4) .bo-section-icon,
        .bo-section.bo-section-destaque:nth-child(5n) .bo-section-icon {
          background: linear-gradient(135deg, #FCD34D, #F59E0B);
          color: #78350F;
        }
        .bo-section-content {
          flex: 1;
          min-width: 0;
        }
        .bo-section-label {
          font-family: 'Montserrat', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #0F172A;
          margin-bottom: 2px;
          letter-spacing: -.1px;
        }
        .bo-section-desc {
          font-size: 12px;
          color: #64748B;
          line-height: 1.45;
        }
        .bo-section-arrow {
          color: #CBD5E1;
          flex-shrink: 0;
          transition: transform .2s, color .2s;
        }
        .bo-section:hover .bo-section-arrow {
          color: #6366F1;
          transform: translateX(2px);
        }
        @media (max-width: 1100px) {
          .bo-metrics { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 900px) {
          .bo-wrap { padding: 24px 18px; }
          .bo-top { margin-bottom: 28px; padding-bottom: 18px; }
          .bo-title { font-size: 26px; letter-spacing: -.8px; }
          .bo-greeting { font-size: 15px; padding: 7px 14px; }
          .bo-sub { font-size: 13px; }
          .bo-sections { grid-template-columns: 1fr; }
          .bo-metric { padding: 18px; }
          .bo-metric-val { font-size: 24px; }
          .bo-section { padding: 16px 18px; gap: 12px; }
          .bo-section-icon { width: 38px; height: 38px; }
          .bo-section-label { font-size: 14px; }
          .bo-section-desc { font-size: 11.5px; }
          .bo-alert { padding: 16px 18px; }
          .bo-alert-icon { width: 38px; height: 38px; }
          .bo-alert-title { font-size: 13.5px; }
          .bo-alert-desc { font-size: 12px; }
        }
        @media (max-width: 640px) {
          .bo-wrap { padding: 18px 14px; }
          .bo-top { flex-wrap: wrap; gap: 12px; }
          .bo-brand-mark { width: 38px; height: 38px; }
          .bo-brand-name { font-size: 13px; }
          .bo-brand-sub { font-size: 10.5px; }
          .bo-brand-source { font-size: 9px; padding: 2px 7px; }
          .bo-brand-source img { height: 12px; }
          .bo-eyebrow { font-size: 10px; padding: 3px 8px; letter-spacing: 1.6px; }
          .bo-title { font-size: 22px; }
          .bo-metrics { grid-template-columns: 1fr; gap: 12px; }
          .bo-metric { padding: 16px; }
          .bo-metric-val { font-size: 22px; }
          .bo-section-title { font-size: 17px; }
        }
        @media (max-width: 420px) {
          .bo-hero { margin-bottom: 22px; }
          .bo-title { font-size: 20px; }
          .bo-metric { padding: 14px; }
        }
      `}</style>
    </div>
  )
}