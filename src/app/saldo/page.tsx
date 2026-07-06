'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type Saque, type Revendedora } from '@/lib/supabase'
import { getFinanceiro, type ComissaoView } from '@/lib/revendedoraClient'
import ModalSaque from '@/components/dashboard/ModalSaque'
import BottomNav from '@/components/dashboard/BottomNav'
import BannerPagamentoPendente from '@/components/dashboard/BannerPagamentoPendente'

export default function SaldoPage() {
  const router = useRouter()
  const [revendedora, setRevendedora] = useState<Revendedora | null>(null)
  const [saques, setSaques] = useState<Saque[]>([])
  const [totais, setTotais] = useState({
    aLiberar: 0,
    totalGanhoComissoes: 0,
    totalSacado: 0,
    emSaque: 0,
  })
  const [comissoes, setComissoes] = useState<ComissaoView[]>([])
  const [loading, setLoading] = useState(true)
  const [modalSaque, setModalSaque] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: rev } = await supabase
        .from('revendedoras').select('*').eq('user_id', user.id).single()
      if (!rev) { router.push('/auth/login'); return }
      setRevendedora(rev)

      const { data: s } = await supabase
        .from('saques').select('*')
        .eq('revendedora_id', rev.id)
        .order('criado_em', { ascending: false })
      setSaques(s || [])

      const fin = await getFinanceiro()
      if (fin.status === 'ok') {
        setTotais({
          aLiberar: fin.data.totais.aLiberar,
          totalGanhoComissoes: fin.data.totais.totalGanhoComissoes,
          totalSacado: fin.data.totais.totalSacado,
          emSaque: fin.data.totais.emSaque,
        })
        setComissoes(fin.data.comissoes || [])
      }

      setLoading(false)
    }
    load()
  }, [router])

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const statusCor = (s: string) => {
    if (s === 'pago') return { bg: '#E1F5EE', color: '#089C82', label: 'Pago' }
    if (s === 'processando') return { bg: 'var(--teal-pale)', color: 'var(--teal-dark)', label: 'Processando' }
    if (s === 'recusado') return { bg: '#FCEBEB', color: '#A32D2D', label: 'Recusado' }
    return { bg: 'var(--rosa-mist)', color: 'var(--rosa)', label: 'Solicitado' }
  }

  if (loading) return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--cinza)' }}>Carregando...</div>
    </div>
  )

  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}>

      <BannerPagamentoPendente status={revendedora?.status} />

      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--rosa-border)', padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)', display: 'flex', alignItems: 'center' }} aria-label="Voltar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)' }}>Saldo & Saques</div>
      </header>

      {/* Saldo hero */}
      <div style={{ background: 'var(--rosa)', padding: '28px 20px 44px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,.08) 1.5px,transparent 1.5px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}/>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, position: 'relative' }}>Saldo disponível</div>
        <div style={{ fontFamily: 'Montserrat', fontSize: 48, fontWeight: 900, color: 'white', letterSpacing: -2, lineHeight: 1, marginBottom: 6, position: 'relative' }}>
          {formatBRL(revendedora?.saldo_disponivel || 0)}
        </div>
        {totais.aLiberar > 0 && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginBottom: 4, position: 'relative' }}>
            + {formatBRL(totais.aLiberar)} a liberar
          </div>
        )}
      </div>

      {/* Botões de saque */}
      <div style={{ margin: '-20px 16px 0', position: 'relative', zIndex: 10 }}>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => setModalSaque(true)}
            disabled={(revendedora?.saldo_disponivel || 0) <= 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '14px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--teal)', color: 'white', fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, opacity: (revendedora?.saldo_disponivel || 0) <= 0 ? .5 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            Sacar via Pix
          </button>
          <button
            onClick={() => setModalSaque(true)}
            disabled={(revendedora?.saldo_disponivel || 0) <= 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '14px 10px', borderRadius: 12, cursor: 'pointer', background: 'var(--rosa-pale)', color: 'var(--rosa)', fontFamily: 'Montserrat', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--rosa-border)', opacity: (revendedora?.saldo_disponivel || 0) <= 0 ? .5 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8396A" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Crédito loja
          </button>
        </div>
      </div>

      {/* Resumo financeiro */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>
          Resumo financeiro
        </div>
        <div className="rv-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Disponível', val: formatBRL(revendedora?.saldo_disponivel || 0), cor: 'var(--teal-pale)', icon: '✅' },
            { label: 'A liberar', val: formatBRL(totais.aLiberar), cor: 'var(--rosa-pale)', icon: '⏳' },
            { label: 'Total em comissões', val: formatBRL(totais.totalGanhoComissoes), cor: 'var(--teal-pale)', icon: '💰' },
            { label: 'Total sacado', val: formatBRL(totais.totalSacado), cor: 'var(--rosa-pale)', icon: '💸' },
          ].map((m, i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)', marginBottom: 3 }}>{m.val}</div>
              <div style={{ fontSize: 11, color: 'var(--cinza)' }}>{m.label}</div>
            </div>
          ))}
        </div>
        {totais.emSaque > 0 && (
          <div style={{ fontSize: 11, color: 'var(--cinza)', textAlign: 'center', marginTop: 10 }}>
            {formatBRL(totais.emSaque)} em saque sendo processado
          </div>
        )}
      </div>

      {/* Próximas liberações — quando cada comissão vence (vira sacável) */}
      {comissoes.filter(c => c.status === 'processando').length > 0 && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>
            Próximas liberações
          </div>
          <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 12 }}>
            Cada comissão libera 20 dias após o pedido pago (prazo p/ trocas/devoluções). A partir da data ela vira saldo sacável.
          </div>
          {comissoes
            .filter(c => c.status === 'processando')
            .sort((a, b) => {
              const da = a.data_liberacao ? Date.parse(a.data_liberacao) : Infinity
              const db = b.data_liberacao ? Date.parse(b.data_liberacao) : Infinity
              return da - db
            })
            .map(c => {
              const dataFmt = c.data_liberacao
                ? new Date(c.data_liberacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'a definir'
              const dias = c.data_liberacao
                ? Math.ceil((Date.parse(c.data_liberacao) - Date.now()) / 86400000)
                : null
              const faltaTxt = dias === null ? '' : dias > 0 ? ` · faltam ${dias} dia${dias > 1 ? 's' : ''}` : ' · libera hoje'
              return (
                <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--rosa-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⏳</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto)', marginBottom: 2 }}>
                      {c.cliente_nome || 'Venda'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cinza)' }}>
                      {c.numero_pedido ? `Pedido ${c.numero_pedido} · ` : ''}Libera em {dataFmt}{faltaTxt}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 800, color: 'var(--texto)' }}>
                      {formatBRL(c.valor_comissao)}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Histórico */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 700, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>
          Histórico de saques
        </div>

        {saques.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💸</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>Nenhum saque ainda</div>
            <div style={{ fontSize: 13, color: 'var(--cinza)' }}>Quando você solicitar saques, eles aparecem aqui.</div>
          </div>
        ) : saques.map(s => {
          const cor = statusCor(s.status)
          return (
            <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: s.tipo === 'pix' ? 'var(--teal-pale)' : 'var(--rosa-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {s.tipo === 'pix' ? '⚡' : '🛍️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--texto)', marginBottom: 2 }}>
                  {s.tipo === 'pix' ? 'Saque via Pix' : 'Crédito na loja'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cinza)' }}>
                  {new Date(s.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {s.chave_pix && ` · ${s.chave_pix.slice(0, 20)}...`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 800, color: 'var(--texto)', marginBottom: 3 }}>
                  {formatBRL(s.valor)}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, fontFamily: 'Montserrat', padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', background: cor.bg, color: cor.color, display: 'inline-block' }}>
                  {cor.label}
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
          onSucesso={() => { setModalSaque(false); window.location.reload() }}
        />
      )}

      <BottomNav ativa="saldo" />
    </div>
  )
}
