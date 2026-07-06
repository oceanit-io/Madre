'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AtualizarBtn from '@/components/admin/AtualizarBtn'

// Link estático InfinitePay (com Apple Pay/PIX/cartão funcionando).
const LINK_PAGAMENTO = 'https://checkout.infinitepay.io/oceanit/sloPjyKw3C'

type RevendedoraPendente = {
  id: string
  nome: string
  email: string
  whatsapp: string
  cidade: string
  estado: string
  criado_em: string
}

// "há 2h 15min" / "há 3d" — pra priorizar quem precisa de cobrança.
function tempoRelativo(iso: string): { texto: string; cor: string; bg: string } {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  const h = Math.floor(min / 60)
  const d = Math.floor(h / 24)
  let texto: string
  if (min < 60) texto = `há ${min}min`
  else if (h < 24) texto = `há ${h}h`
  else texto = `há ${d}d`
  // Cores por urgência: <1h cinza, 1-24h azul, 1-3d âmbar, >3d vermelho.
  if (h < 1) return { texto, cor: '#6B7280', bg: '#F3F4F6' }
  if (h < 24) return { texto, cor: '#1D4ED8', bg: '#DBEAFE' }
  if (d < 3) return { texto, cor: '#92400E', bg: '#FEF3C7' }
  return { texto, cor: '#991B1B', bg: '#FEE2E2' }
}

function msgWhatsApp(nome: string): string {
  return encodeURIComponent(
    `Oi ${nome.split(' ')[0]}! Vimos teu cadastro no Prata 925 ✨\n\n` +
    `Pra ativar tua loja com +3.000 peças de prata 925 só falta a taxa única de R$ 39,90 (PIX, Apple Pay, boleto ou cartão):\n${LINK_PAGAMENTO}\n\n` +
    `Em poucos minutos depois do pagamento eu ativo tua loja e você pode começar a vender. Qualquer dúvida me chama por aqui! 💎`
  )
}

export default function AdminAtivarPage() {
  const router = useRouter()
  const [pendentes, setPendentes] = useState<RevendedoraPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null)
  const [ativando, setAtivando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(LINK_PAGAMENTO)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      window.prompt('Copia o link abaixo:', LINK_PAGAMENTO)
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'ok') {
      router.replace('/admin')
      return
    }
    carregarPendentes()
  }, [])

  async function carregarPendentes() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/pendentes', {
        headers: {},
        cache: 'no-store',
      })
      if (!res.ok) {
        setPendentes([])
        return
      }
      const data = await res.json()
      setPendentes(data || [])
    } catch (e) {
      console.error('Erro ao carregar pendentes:', e)
      setPendentes([])
    } finally {
      setLoading(false)
      setRefreshing(false)
      setUltimaAtualizacao(Date.now())
    }
  }

  async function ativarRevendedora(id: string, nome: string) {
    if (!confirm(`Confirmar ativação de ${nome}?\n\nVerifique se o pagamento de R$ 39,90 foi recebido.`)) return

    setAtivando(id)

    const res = await fetch('/api/admin/ativar-revendedora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revendedora_id: id, nome }),
    })

    if (!res.ok) {
      alert('Erro ao ativar. Tenta de novo.')
      setAtivando(null)
      return
    }

    setMensagem(`✅ ${nome} ativada com sucesso!`)
    setTimeout(() => setMensagem(''), 4000)
    setAtivando(null)
    carregarPendentes()
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 14, padding: 0 }}
        >
          ← Voltar
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Inter', fontSize: 28, fontWeight: 800, color: '#111827', margin: 0 }}>
          Ativar revendedoras
        </h1>
        <AtualizarBtn
          onClick={carregarPendentes}
          loading={refreshing}
          ultimaAtualizacao={ultimaAtualizacao}
        />
      </div>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 32 }}>
        Revendedoras pendentes de ativação. Confirme o pagamento antes de ativar.
      </p>

      {mensagem && (
        <div style={{ background: '#D1FAE5', border: '1px solid #10B981', color: '#065F46', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
          {mensagem}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>Carregando...</div>
      ) : pendentes.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
          <div style={{ fontFamily: 'Inter', fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            Nenhuma pendente
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            Todas as revendedoras estão ativas.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendentes.map(r => {
            const t = tempoRelativo(r.criado_em)
            const wa = r.whatsapp.replace(/\D/g, '')
            return (
              <div key={r.id} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontSize: 18, fontWeight: 800, color: '#92400E', flexShrink: 0 }}>
                  {r.nome[0]?.toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: '#111827' }}>
                      {r.nome}
                    </div>
                    <span style={{ background: t.bg, color: t.cor, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: .2 }}>
                      ⏱ {t.texto}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                    📧 {r.email}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                    📱 {r.whatsapp} · 📍 {r.cidade}/{r.estado}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Cadastrada em {new Date(r.criado_em).toLocaleDateString('pt-BR')} às {new Date(r.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                  <a
                    href={`https://wa.me/55${r.whatsapp.replace(/\D/g, '')}?text=${msgWhatsApp(r.nome)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#1FAD52', color: 'white',
                      borderRadius: 10, padding: '10px 14px',
                      fontFamily: 'Inter', fontSize: 12, fontWeight: 700,
                      textDecoration: 'none', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    💬 WhatsApp
                  </a>
                  <button
                    onClick={copiarLink}
                    style={{
                      background: copiado ? '#10B981' : '#F3F4F6',
                      color: copiado ? 'white' : '#374151',
                      border: '1px solid', borderColor: copiado ? '#10B981' : '#E5E7EB',
                      borderRadius: 10, padding: '10px 14px',
                      fontFamily: 'Inter', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {copiado ? '✓ Copiado!' : '📋 Copiar link'}
                  </button>
                  <button
                    onClick={() => ativarRevendedora(r.id, r.nome)}
                    disabled={ativando === r.id}
                    style={{
                      background: ativando === r.id ? '#9CA3AF' : '#10B981',
                      color: 'white', border: 'none',
                      borderRadius: 10, padding: '10px 16px',
                      fontFamily: 'Inter', fontSize: 12, fontWeight: 700,
                      cursor: ativando === r.id ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ativando === r.id ? '⏳ Ativando...' : '✓ Ativar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pendentes.length > 0 && (
        <div style={{ marginTop: 24, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: 16, fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
          ⚠️ <strong>Importante:</strong> Confirme no painel InfinityPay que o pagamento de R$ 39,90 foi recebido ANTES de ativar. Uma vez ativada, a revendedora pode começar a vender.
        </div>
      )}

    </div>
  )
}