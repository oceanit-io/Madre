'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type Revendedora, type Notificacao } from '@/lib/supabase'
import { getFinanceiro, getVisitas, type ComissaoView, type PedidoAguardando } from '@/lib/revendedoraClient'
import { mensagemDoDia } from '@/lib/mensagensMotivacionais'
import { comissaoStatusMeta, diasParaLiberar } from '@/lib/comissoesCalc'
import { situacaoMensalidade } from '@/lib/mensalidade'
import ModalSaque from '@/components/dashboard/ModalSaque'
import BottomNav from '@/components/dashboard/BottomNav'
import TourGuiado from '@/components/dashboard/TourGuiado'
import { PixLogo } from '@/components/PixLogo'
import { INFINITEPAY_LINK_DINAMICO } from '@/lib/infinitepayConfig'

const LINK_PAGAMENTO = 'https://checkout.infinitepay.io/oceanit/sloPjyKw3C'
// Comunidade de revendedoras (canal WhatsApp). SÓ aparece no painel logado
// da revendedora — NUNCA na loja pública que o comprador vê.
const COMUNIDADE_URL = 'https://whatsapp.com/channel/0029Vb876yHL7UVbgoywno1T'
// Material de divulgação (pasta Google Drive). Preencher quando estiver pronto.
const MATERIAL_DRIVE_URL = ''

export default function DashboardPage() {
  const router = useRouter()
  const [revendedora, setRevendedora] = useState<Revendedora | null>(null)
  const [comissoes, setComissoes] = useState<ComissaoView[]>([])
  const [pedidosAguardando, setPedidosAguardando] = useState<PedidoAguardando[]>([])
  const [aLiberar, setALiberar] = useState(0)
  const [totalGanhoComissoes, setTotalGanhoComissoes] = useState(0)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalSaque, setModalSaque] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [hostLoja, setHostLoja] = useState('')
  const [visitas, setVisitas] = useState({ hoje: 0, ultimos_7d: 0 })
  // Link de pagamento da mensalidade: prefere o DINÂMICO (order_nsu=cad_<id>)
  // que renova/ativa a loja sozinho pelo webhook; fallback estático.
  const [linkPagamento, setLinkPagamento] = useState(LINK_PAGAMENTO)
  useEffect(() => {
    // Link dinâmico desligado temporariamente (bug do checkout InfinitePay).
    if (!INFINITEPAY_LINK_DINAMICO) return
    const email = revendedora?.email
    if (!email) return
    let vivo = true
    fetch('/api/auth/criar-pagamento-cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo && d?.link) setLinkPagamento(d.link) })
      .catch(() => { /* mantém fallback estático */ })
    return () => { vivo = false }
  }, [revendedora?.email])

  useEffect(() => {
    // Mostra sempre o domínio canônico (lojadeprata925.com.br), não o
    // host atual — assim o link que a revendedora compartilha não vira
    // `.vercel.app/...` se ela entrou via URL antiga.
    const canon = (process.env.NEXT_PUBLIC_APP_URL || '').trim()
    if (canon) {
      try { setHostLoja(new URL(canon).host); return } catch {}
    }
    setHostLoja(window.location.host)
  }, [])

  useEffect(() => {
    async function carregarDados() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: rev } = await supabase
        .from('revendedoras')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!rev) { router.push('/auth/login'); return }
      setRevendedora(rev)

      const { data: n } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('revendedora_id', rev.id)
        .eq('lida', false)
        .order('criado_em', { ascending: false })
        .limit(10)
      setNotificacoes(n || [])

      const fin = await getFinanceiro()
      if (fin.status === 'ok') {
        setComissoes(fin.data.comissoes)
        setPedidosAguardando(fin.data.pedidosAguardando || [])
        setALiberar(fin.data.totais.aLiberar)
        setTotalGanhoComissoes(fin.data.totais.totalGanhoComissoes)
      }

      getVisitas().then(setVisitas).catch(() => { /* mantém 0 */ })

      setLoading(false)
    }
    carregarDados()
  }, [router])

  // Auto-refresh silencioso: atualiza notificações + comissões +
  // "esperando pagamento" + saldos a cada 20s enquanto a tab estiver
  // visível. Para quando vai pra background (não gasta bateria/dados),
  // e refresca na hora quando a usuária volta pra tab.
  useEffect(() => {
    const revId = revendedora?.id
    if (!revId) return

    let cancelado = false
    let interval: ReturnType<typeof setInterval> | null = null

    async function refresh() {
      if (cancelado) return
      try {
        const supabase = createClient()

        // Status check: se ela era pendente e ficou ativa (webhook/admin
        // ativou em background), reload pra mostrar dashboard sem banner.
        const { data: revAtual } = await supabase
          .from('revendedoras')
          .select('status')
          .eq('id', revId)
          .single()
        if (revAtual && revAtual.status !== revendedora?.status) {
          // Status mudou — reload pra refletir tudo (banner, banners, links etc)
          window.location.reload()
          return
        }

        const { data: n } = await supabase
          .from('notificacoes')
          .select('*')
          .eq('revendedora_id', revId)
          .eq('lida', false)
          .order('criado_em', { ascending: false })
          .limit(10)
        if (!cancelado) setNotificacoes(n || [])

        const fin = await getFinanceiro()
        if (!cancelado && fin.status === 'ok') {
          setComissoes(fin.data.comissoes)
          setPedidosAguardando(fin.data.pedidosAguardando || [])
          setALiberar(fin.data.totais.aLiberar)
          setTotalGanhoComissoes(fin.data.totais.totalGanhoComissoes)
        }
      } catch {
        /* silencioso — próximo ciclo tenta de novo */
      }
    }

    function start() {
      if (interval) return
      interval = setInterval(refresh, 20000)
    }
    function stop() {
      if (interval) clearInterval(interval)
      interval = null
    }
    function onVis() {
      if (document.visibilityState === 'visible') {
        refresh() // refresh imediato ao voltar pra tab
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelado = true
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [revendedora?.id])

  function lojaUrl() {
    if (!revendedora) return ''
    // SEMPRE usar o domínio canônico (lojadeprata925.com.br) — evita
    // que o link compartilhado vire `.vercel.app/...` se a revendedora
    // acessou o dashboard via URL antiga.
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '')
    // .trim() remove espaço acidental no env (ex "...com.br " gerava
    // "...com.br /loja/..."); replace tira barra final.
    return `${base.trim().replace(/\/$/, '')}/loja/${(revendedora.subdominio || '').trim()}`
  }

  function copiarLink() {
    if (!revendedora) return
    navigator.clipboard.writeText(lojaUrl())
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  async function dispensarNotif(id: string) {
    setNotificacoes(prev => prev.filter(n => n.id !== id))
    try {
      const supabase = createClient()
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    } catch {}
  }

  if (loading) {
    return (
      <div className="revendedora-app" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--rosa-border)', borderTopColor: 'var(--rosa)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}/>
          <div style={{ fontSize: 13, color: 'var(--cinza)' }}>Carregando sua loja...</div>
        </div>
      </div>
    )
  }

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long' })
  const agora = new Date()
  const comissoesMes = comissoes.filter(c => {
    const d = new Date(c.created_at)
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
  })
  // Total ganho no mês = soma de TODAS as comissões do mês exceto canceladas
  // (incluindo as 'processando' nos 20d). É o que a revendedora "ganhou"
  // de vendas, mesmo que ainda não tenha liberado.
  const comissaoMes = comissoesMes
    .filter(c => c.status !== 'cancelada')
    .reduce((acc, c) => acc + c.valor_comissao, 0)

  const mens = revendedora
    ? situacaoMensalidade(
        revendedora.mensalidade_vence_em ?? null,
        !!revendedora.mensalidade_isento
      )
    : null
  const mostrarAvisoMens =
    !!mens &&
    revendedora?.status !== 'pendente' &&
    ['a_vencer', 'vence_hoje', 'vencida'].includes(mens.situacao)

  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>

      {revendedora?.status === 'pendente' && (
        <div className="rv-sticky-banner" style={{ background: '#FEF2F2', borderBottom: '1px solid #FCA5A5', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 18 }}>⚠️</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 800, color: '#991B1B' }}>
              Conta aguardando ativação
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5, marginBottom: 10 }}>
            Para começar a vender, faça o pagamento de R$ 39,90. Assim que confirmarmos, sua loja fica ativa em poucos minutos ✨
          </div>
          <a
            href={linkPagamento}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', background: '#DC2626', color: 'white', fontFamily: 'Montserrat', fontSize: 12, fontWeight: 800, padding: '10px 16px', borderRadius: 8, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.4px', boxShadow: '0 2px 8px rgba(220,38,38,.3)' }}
          >
            💳 Pagar R$ 39,90 agora
          </a>
        </div>
      )}

      {mostrarAvisoMens && mens && (
        <div className="rv-sticky-banner" style={{ background: mens.situacao === 'vencida' ? '#FEE2E2' : '#FFFBEB', borderBottom: `1px solid ${mens.situacao === 'vencida' ? '#FCA5A5' : '#FCD34D'}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 199 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 18 }}>{mens.situacao === 'vencida' ? '🔒' : '⏰'}</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 800, color: mens.situacao === 'vencida' ? '#991B1B' : '#92400E' }}>
              {mens.situacao === 'vencida'
                ? 'Loja pausada por mensalidade vencida'
                : mens.situacao === 'vence_hoje'
                ? 'Sua mensalidade vence HOJE 💛'
                : `Sua mensalidade vence em ${mens.dias} ${mens.dias === 1 ? 'dia' : 'dias'}`}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5, marginBottom: 10 }}>
            {mens.situacao === 'vencida'
              ? 'Regularize a mensalidade (R$ 39,90) e sua loja volta ao ar na hora pra você seguir vendendo! 💪'
              : 'Mantenha sua loja no ar e continue faturando 💎 Pague a mensalidade (R$ 39,90) e fique tranquila!'}
          </div>
          <a
            href={linkPagamento}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', background: mens.situacao === 'vencida' ? '#DC2626' : '#D97706', color: 'white', fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 8, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.3px' }}
          >
            💳 Pagar mensalidade
          </a>
        </div>
      )}

      <header style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 800, color: 'var(--texto)', lineHeight: 1.1 }}>
            {revendedora?.nome_loja || `Olá, ${revendedora?.nome?.split(' ')[0]}`}
          </div>
          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cinza)', marginTop: 3 }}>
            Minha loja 925
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off)', borderRadius: '50%', border: '1px solid var(--cinza-light)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {notificacoes.length > 0 && (
              <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--rosa)', border: '1.5px solid white' }}/>
            )}
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rosa-pale)', border: '2px solid var(--rosa-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800, color: 'var(--rosa)', cursor: 'pointer' }}>
            {revendedora?.nome?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      <div style={{ background: 'var(--rosa)', padding: '20px 20px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.08) 1.5px,transparent 1.5px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}/>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginBottom: 3, position: 'relative' }}>Olá, bem-vinda de volta 👋</div>
        <div style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 900, color: 'white', marginBottom: 8, position: 'relative' }}>
          {revendedora?.nome?.split(' ')[0]}
        </div>
        {(() => {
          // Estado real da LOJA: 'ativa' só vende de verdade com conta bancária
          // cadastrada (recebedor). Sem isso, mostra "inativa - falta cadastro".
          const ativa = revendedora?.status === 'ativa'
          const semConta = ativa && !revendedora?.pagarme_recipient_id
          const cor = semConta ? '#FCA5A5' : ativa ? '#5DD9C1' : '#FCD34D'
          const txt = semConta ? 'Loja inativa · falta cadastrar conta' : ativa ? 'Revendedora ativa' : 'Pendente de ativação'
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.15)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: 'rgba(255,255,255,.9)', fontWeight: 500, position: 'relative' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cor }}/>
              {txt}
            </div>
          )
        })()}

        {/* Selo: Catálogo by Prata 15 — pill branca pra preservar a marca rosa */}
        <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 999, padding: '4px 10px 4px 12px', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <span style={{ fontSize: 9, color: '#9B2C5A', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
            Catálogo by
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/logo-p15.png"
            alt="Prata de 15 Reais"
            style={{ height: 18, width: 'auto', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* ALERTA: loja INATIVA pra vendas até cadastrar a conta bancária.
          Sem recebedor cadastrado, /api/pedidos barra os pedidos. */}
      {revendedora?.status === 'ativa' && !revendedora?.pagarme_recipient_id && (
        <div style={{ margin: '14px 16px 0' }}>
          <div style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)', border: '1.5px solid #FCA5A5', borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <span style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 14, color: '#B91C1C' }}>
                Sua loja ainda NÃO está vendendo
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.5, marginBottom: 12 }}>
              Pra começar a receber pedidos você precisa <strong>cadastrar sua conta bancária</strong>.
              Enquanto não cadastrar, sua loja fica <strong>inativa para vendas</strong>.
            </div>
            <button
              onClick={() => router.push('/perfil/recebedor')}
              style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontFamily: 'Montserrat', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', width: '100%', boxShadow: '0 6px 16px rgba(220,38,38,.3)' }}
            >
              💳 Cadastrar conta bancária e ativar vendas
            </button>
          </div>
        </div>
      )}

      <div style={{ margin: '-16px 16px 0', position: 'relative', zIndex: 10 }} data-tour="saldo">
        <div className="card fade-up" style={{ padding: 20, boxShadow: '0 4px 20px rgba(232,57,106,.1)' }}>
          <div style={{ fontSize: 11, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>
            Saldo disponível para saque
          </div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 38, fontWeight: 900, color: 'var(--texto)', lineHeight: 1, letterSpacing: -2, marginBottom: 4 }}>
            <sup style={{ fontSize: 16, color: 'var(--cinza)', verticalAlign: 'top', marginTop: 8, display: 'inline-block' }}>R$</sup>
            {formatBRL(revendedora?.saldo_disponivel || 0).replace('R$ ', '').replace('R$', '')}
          </div>
          {aLiberar > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--cinza)' }}>
                + <span style={{ color: 'var(--rosa)', fontWeight: 600 }}>{formatBRL(aLiberar)}</span> a liberar
              </div>
              <div style={{ fontSize: 10, color: 'var(--cinza)', marginBottom: 16, marginTop: 2, fontStyle: 'italic' }}>
                🔒 Liberação em 20 dias. Esperamos esse prazo para cobrir eventuais trocas ou devoluções da venda
              </div>
            </>
          )}
          <div style={{ marginTop: 18 }}>
            {/* Sacar via Pix — primário, full-width, com destaque */}
            <button
              onClick={() => setModalSaque(true)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '16px 20px',
                borderRadius: 14,
                border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #22c9a1 0%, #1ba78a 100%)',
                color: 'white',
                fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: .5,
                boxShadow: '0 6px 18px rgba(11,191,160,.35)',
              }}
            >
              <span style={{
                background: 'white', borderRadius: 10, padding: '7px 12px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PixLogo size={22} />
              </span>
              Sacar
            </button>
            {/* Crédito loja — secundário, menor, link-style */}
            <button
              onClick={() => setModalSaque(true)}
              style={{
                width: '100%', marginTop: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 14px',
                borderRadius: 12, cursor: 'pointer',
                background: 'var(--rosa-pale)',
                color: 'var(--rosa)',
                fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700,
                border: '1.5px solid var(--rosa-border)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff7db4" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              Ou usar como crédito na loja
            </button>
          </div>
        </div>
      </div>

      {/* Mensagem motivacional do dia + visitas (só pra loja ativa). */}
      {revendedora?.status === 'ativa' && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ background: 'linear-gradient(135deg, #fff5fa 0%, #e6faf3 100%)', border: '1px solid var(--rosa-border)', borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--rosa)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
              💌 Mensagem do dia
            </div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, color: 'var(--texto)', lineHeight: 1.5 }}>
              {mensagemDoDia()}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--rosa-border)', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--rosa-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👀</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 900, color: 'var(--texto)', lineHeight: 1 }}>
                {visitas.hoje} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cinza)' }}>{visitas.hoje === 1 ? 'visita hoje' : 'visitas hoje'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--cinza)', marginTop: 2 }}>
                {visitas.ultimos_7d} nos últimos 7 dias. Compartilhe seu link e veja subir 🚀
              </div>
            </div>
          </div>

          {/* Comunidade WhatsApp + Material de divulgação — SÓ no painel
              logado da revendedora (nunca na loja pública do comprador). */}
          <a
            href={COMUNIDADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, textDecoration: 'none', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', borderRadius: 16, padding: '14px 16px', boxShadow: '0 8px 24px rgba(37,211,102,.28)' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>💬</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 2 }}>
                Entre na comunidade 💎
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.92)', lineHeight: 1.4 }}>
                Novidades, dicas de venda e promoções em primeira mão. Só pra revendedoras!
              </div>
            </div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, flexShrink: 0 }}>→</div>
          </a>

          {MATERIAL_DRIVE_URL ? (
            <a
              href={MATERIAL_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, textDecoration: 'none', background: '#fff', border: '1px solid var(--rosa-border)', borderRadius: 16, padding: '14px 16px' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📁</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800, color: 'var(--texto)' }}>
                  Material de divulgação
                </div>
                <div style={{ fontSize: 12, color: 'var(--cinza)', marginTop: 2 }}>
                  Fotos, artes e vídeos prontos pra postar e vender.
                </div>
              </div>
              <div style={{ color: 'var(--rosa)', fontSize: 20, fontWeight: 800, flexShrink: 0 }}>→</div>
            </a>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, background: '#fff', border: '1px dashed var(--rosa-border)', borderRadius: 16, padding: '14px 16px', opacity: .8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📁</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800, color: 'var(--texto)' }}>
                  Material de divulgação
                </div>
                <div style={{ fontSize: 12, color: 'var(--cinza)', marginTop: 2 }}>
                  Em breve: fotos, artes e vídeos prontos pra postar.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Onboarding nudge: aparece quando a revendedora está ativa mas
          ainda não personalizou NADA (todos os campos opcionais vazios).
          Convida a configurar antes de compartilhar a loja. */}
      {revendedora?.status === 'ativa' &&
        !revendedora?.nome_loja &&
        !revendedora?.foto_url &&
        !revendedora?.cor_tema && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={() => router.push('/configurar-loja')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, #fff5fa 0%, #e6faf3 100%)',
              border: '1px solid var(--rosa-border)', borderRadius: 16,
              padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              ✨
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 800, color: 'var(--texto)', marginBottom: 2 }}>
                Personalize sua loja antes de compartilhar
              </div>
              <div style={{ fontSize: 12, color: 'var(--cinza)', lineHeight: 1.4 }}>
                Nome, cor, fonte e logo. Leva 2 minutos e deixa sua loja única.
              </div>
            </div>
            <div style={{ color: 'var(--rosa)', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>→</div>
          </button>
        </div>
      )}

      {/* CTA cadastro recebedor: aparece quando a loja já está personalizada
          (status ativa + nome_loja preenchido) MAS a revendedora ainda não
          preencheu o cadastro bancário pra receber split do Pagar.me.
          Animação sutil pra chamar atenção sem ficar agressiva. */}
      {revendedora?.status === 'ativa' &&
        revendedora?.nome_loja &&
        !revendedora?.pagarme_recipient_id && (
        <div style={{ padding: '16px 16px 0' }}>
          <style>{`
            @keyframes rvShine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
            .rv-cta-recebedor { background: linear-gradient(110deg, #11b89a 0%, #14d4af 35%, #fff 50%, #14d4af 65%, #11b89a 100%); background-size: 200% auto; animation: rvShine 5s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .rv-cta-recebedor { animation: none; background: linear-gradient(135deg, #11b89a 0%, #14d4af 100%); } }
          `}</style>
          <button
            onClick={() => router.push('/perfil/recebedor')}
            className="rv-cta-recebedor"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              border: 'none', borderRadius: 18,
              padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit',
              boxShadow: '0 10px 30px rgba(17,184,154,.28)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(255,255,255,.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,.12)',
            }}>
              💰
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'Montserrat', fontSize: 14, fontWeight: 900,
                color: '#FFF', marginBottom: 3,
                textShadow: '0 1px 2px rgba(0,0,0,.15)',
                wordBreak: 'break-word', overflowWrap: 'anywhere',
              }}>
                💎 Preencha pra receber suas comissões
              </div>
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,.95)', lineHeight: 1.4,
                wordBreak: 'break-word', overflowWrap: 'anywhere',
                textShadow: '0 1px 2px rgba(0,0,0,.1)',
              }}>
                Cadastre seus dados bancários. O dinheiro cai direto na sua conta a cada venda
              </div>
            </div>
            <div style={{
              color: '#FFF', fontSize: 22, fontWeight: 800, flexShrink: 0,
              textShadow: '0 1px 2px rgba(0,0,0,.15)',
            }}>→</div>
          </button>
        </div>
      )}

      {notificacoes.length > 0 && (
        <div className="rv-notif-wrap" style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notificacoes.map(n => (
              <div key={n.id} className="rv-notif-card" style={{ background: 'linear-gradient(135deg, #fff5fa 0%, #e6faf3 100%)', border: '1px solid var(--rosa-border)', borderRadius: 16, padding: '16px 16px 14px', position: 'relative' }}>
                <button
                  onClick={() => dispensarNotif(n.id)}
                  aria-label="Dispensar"
                  style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)', fontSize: 20, lineHeight: 1 }}
                >
                  ×
                </button>
                <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 800, color: 'var(--texto)', marginBottom: 4, paddingRight: 22, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {n.titulo}
                </div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.55, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {n.mensagem}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guia prática (ebook) — sempre visível. Abre o PDF em nova aba.
          Material de apoio pra revendedora vender nas redes sociais. */}
      <div style={{ padding: '20px 16px 0' }}>
        <a
          href="/guia-revendedora.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'linear-gradient(135deg, #2a1020 0%, #3d1228 100%)',
            borderRadius: 18, padding: '16px 18px', textDecoration: 'none',
            boxShadow: '0 10px 30px rgba(232,57,106,.22)',
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#E8396A,#F4628C)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
            📲
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 3 }}>
              Guia: como vender nas redes 💎
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', lineHeight: 1.4 }}>
              Do zero ao primeiro Pix. Scripts de WhatsApp, ideias de post e respostas prontas. Direto ao ponto.
            </div>
          </div>
          <div style={{ color: '#F4628C', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>→</div>
        </a>
      </div>

      {pedidosAguardando.length > 0 && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 800, color: 'var(--texto)', textTransform: 'uppercase', letterSpacing: .3 }}>
              🔔 Esperando pagamento ({pedidosAguardando.length})
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 10, lineHeight: 1.4 }}>
            Clientas que iniciaram a compra mas não pagaram. Mande um WhatsApp pra recuperar, ou descarte se a venda não rolar.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pedidosAguardando.slice(0, 5).map(p => {
              const wa = (p.cliente_telefone || '').replace(/\D/g, '')
              const primeiro = (p.cliente_nome || '').split(' ')[0] || ''
              const totalStr = formatBRL(p.total)
              const msg = encodeURIComponent(
                `Oi ${primeiro}! 💎 Vi que você esqueceu sua compra de ${totalStr} na minha loja. Quer que eu te ajude a finalizar? Te mando o link!`
              )
              const diffMs = Date.now() - new Date(p.created_at).getTime()
              const min = Math.floor(diffMs / 60000)
              const h = Math.floor(min / 60)
              const dd = Math.floor(h / 24)
              const tempoTxt = min < 60 ? `há ${min}min` : h < 24 ? `há ${h}h` : `há ${dd}d`
              return (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🛒</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.cliente_nome || 'Cliente'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cinza)' }}>
                      {totalStr} · {tempoTxt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {wa ? (
                      <a
                        href={`https://wa.me/55${wa}?text=${msg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1FAD52', color: 'white', borderRadius: 8, padding: '6px 10px', fontFamily: 'Montserrat', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                      >
                        💬 WhatsApp
                      </a>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--cinza)', fontStyle: 'italic' }}>sem telefone</div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Descartar este pedido? Ele some do painel.')) return
                        try {
                          const { createClient } = await import('@/lib/supabase')
                          const supabase = createClient()
                          const { data: { session } } = await supabase.auth.getSession()
                          if (!session) return
                          const res = await fetch(`/api/revendedora/pedidos/${p.id}/dispensar`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${session.access_token}` },
                          })
                          if (res.ok) setPedidosAguardando(prev => prev.filter(x => x.id !== p.id))
                        } catch { /* ignore */ }
                      }}
                      style={{ background: 'transparent', border: '1px solid var(--cinza-light)', color: 'var(--cinza)', borderRadius: 8, padding: '6px 10px', fontFamily: 'Montserrat', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      aria-label="Descartar pedido"
                    >
                      ✕ Descartar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ padding: '20px 16px 0' }} data-tour="resumo">
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          Resumo de {mesAtual}
        </div>
        <div className="rv-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: '🛍️', val: comissoesMes.length.toString(), label: 'Vendas no mês', cor: 'var(--teal-pale)', href: '/vendas' },
            { icon: '💰', val: formatBRL(comissaoMes), label: 'Comissão do mês', cor: 'var(--rosa-pale)', href: '/vendas' },
            { icon: '⏳', val: formatBRL(aLiberar), label: 'A liberar', cor: 'var(--teal-pale)', href: '/saldo' },
            { icon: '💸', val: formatBRL(totalGanhoComissoes), label: 'Total em comissões', cor: 'var(--rosa-pale)', href: '/saldo' },
          ].map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => router.push(m.href)}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: 'none', width: '100%' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: m.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 18 }}>
                {m.icon}
              </div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 18, fontWeight: 900, color: 'var(--texto)', lineHeight: 1, marginBottom: 3 }}>{m.val}</div>
              <div style={{ fontSize: 11, color: 'var(--cinza)' }}>{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }} data-tour="link-loja">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--rosa-pale)', border: '1px solid var(--rosa-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff7db4" strokeWidth="2" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, color: 'var(--texto)' }}>Minha loja virtual</div>
              <div style={{ fontSize: 11, color: 'var(--cinza)' }}>+3.000 itens · ativa agora</div>
            </div>
          </div>
          <div style={{ background: 'var(--off)', border: '1px solid var(--cinza-light)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--teal-dark)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hostLoja}/loja/{revendedora?.subdominio}
            </div>
            <button onClick={copiarLink} style={{ background: linkCopiado ? 'var(--teal)' : 'var(--teal-pale)', color: linkCopiado ? 'white' : 'var(--teal-dark)', border: '1px solid var(--teal-border)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .2s' }}>
              {linkCopiado ? '✓ Copiado!' : 'Copiar link'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.open(lojaUrl(), '_blank')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat', cursor: 'pointer', border: 'none', background: 'var(--rosa)', color: 'white' }}>
              👁️ Ver minha loja
            </button>
            <button onClick={copiarLink} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat', cursor: 'pointer', background: 'var(--rosa-pale)', color: 'var(--rosa)', border: '1.5px solid var(--rosa-border)' }}>
              📲 Compartilhar
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }} data-tour="comissoes">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Últimas comissões
          </div>
          <button onClick={() => router.push('/vendas')} style={{ fontSize: 12, color: 'var(--rosa)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            Ver todas →
          </button>
        </div>

        {comissoes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>Sua primeira venda está logo ali! 💎</div>
            <div style={{ fontSize: 13, color: 'var(--cinza)' }}>Compartilhe o link da sua loja e bora faturar! 🚀</div>
          </div>
        ) : comissoes.slice(0, 5).map(c => {
          const meta = comissaoStatusMeta(c.status)
          const dias = c.status === 'processando' ? diasParaLiberar(c.data_liberacao) : null
          return (
            <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--rosa-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>💎</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
                  {c.numero_pedido || 'Pedido'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cinza)' }}>
                  {new Date(c.created_at).toLocaleDateString('pt-BR')} · {c.cliente_nome || 'cliente'}
                </div>
                {dias !== null && (
                  <div style={{ fontSize: 10, color: '#92400E', fontWeight: 600, marginTop: 3 }}>
                    🔒 Libera {dias === 0 ? 'hoje' : `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 800, color: 'var(--teal-dark)' }}>
                  +{formatBRL(c.valor_comissao)}
                </div>
                <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, fontFamily: 'Montserrat', letterSpacing: '0.3px', padding: '3px 8px', borderRadius: 20, marginTop: 3, textTransform: 'uppercase', background: meta.bg, color: meta.color }}>
                  {meta.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {modalSaque && (
        <ModalSaque
          saldoDisponivel={revendedora?.saldo_disponivel || 0}
          revendedoraId={revendedora?.id || ''}
          onClose={() => setModalSaque(false)}
          onSucesso={() => {
            setModalSaque(false)
            window.location.reload()
          }}
        />
      )}

      <div data-tour="bottom-nav">
        <BottomNav ativa="dashboard" />
      </div>

      <TourGuiado />
    </div>
  )
}
