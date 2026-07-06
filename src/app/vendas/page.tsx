'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPedidos, type PedidoView } from '@/lib/revendedoraClient'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/dashboard/BottomNav'
import BannerPagamentoPendente from '@/components/dashboard/BannerPagamentoPendente'

// Filtros por status do PEDIDO (não da comissão — a revendedora pensa em
// "o que tenho pra enviar / o que já mandei", não em status financeiro).
type Filtro =
  | 'todos'
  | 'pago'           // pago, falta enviar
  | 'enviado'        // já mandou
  | 'entregue'
  | 'aguardando_pagamento'
  | 'cancelado'

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', bg: '#FFF7ED', color: '#C2410C' },
  pago:                 { label: '💰 Pago — Enviar',     bg: '#DCFCE7', color: '#15803D' },
  enviado:              { label: '📦 Enviado',           bg: '#DBEAFE', color: '#1D4ED8' },
  entregue:             { label: '✅ Entregue',          bg: '#E0E7FF', color: '#4338CA' },
  cancelado:            { label: 'Cancelado',            bg: '#FEE2E2', color: '#B91C1C' },
}

function statusMeta(s: string) {
  return STATUS_META[s] || { label: s, bg: '#F4F4F5', color: '#52525B' }
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function maskFone(s: string): string {
  const d = (s || '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return s
}

function maskCPF(s: string): string {
  const d = (s || '').replace(/\D/g, '')
  if (d.length !== 11) return s
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCEP(s: string): string {
  const d = (s || '').replace(/\D/g, '')
  if (d.length !== 8) return s
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function linkWhatsApp(telefone: string, numeroPedido: string | null, total: number): string {
  const d = (telefone || '').replace(/\D/g, '')
  if (d.length < 10) return ''
  const msg = encodeURIComponent(
    `Olá! Sobre o seu pedido ${numeroPedido || ''} (${fmtBRL(total)}) 💎`
  )
  return `https://wa.me/55${d}?text=${msg}`
}

export default function VendasPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<PedidoView[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [statusConta, setStatusConta] = useState<string | null>(null)
  const [temConta, setTemConta] = useState(false)
  // Edição do código de rastreio: id do pedido em edição → valor atual no input
  const [rastreioEdit, setRastreioEdit] = useState<Record<string, string>>({})
  const [salvandoRastreio, setSalvandoRastreio] = useState<string | null>(null)
  const [rastreioSalvo, setRastreioSalvo] = useState<string | null>(null)

  async function salvarRastreio(pedidoId: string, codigo: string) {
    setSalvandoRastreio(pedidoId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setSalvandoRastreio(null); return }

      const res = await fetch(`/api/revendedora/pedidos/${pedidoId}/rastreio`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_rastreio: codigo }),
      })
      const j = await res.json()
      if (res.ok) {
        // Atualiza state local sem refazer fetch
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, codigo_rastreio: j.codigo_rastreio } : p))
        setRastreioSalvo(pedidoId)
        setTimeout(() => setRastreioSalvo(null), 2000)
      } else {
        alert(j?.erro || 'Erro ao salvar')
      }
    } catch {
      alert('Erro de conexão')
    }
    setSalvandoRastreio(null)
  }

  useEffect(() => {
    async function load() {
      const r = await getPedidos()
      if (r.status === 'unauth') { router.push('/auth/login'); return }
      if (r.status === 'ok') setPedidos(r.pedidos)
      // Status da conta pra banner de pendente
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: rev } = await supabase
            .from('revendedoras').select('status, pagarme_recipient_id').eq('user_id', user.id).single()
          if (rev) {
            setStatusConta(rev.status || null)
            setTemConta(!!rev.pagarme_recipient_id)
          }
        }
      } catch { /* */ }
      setLoading(false)
    }
    load()
  }, [router])

  const totais = useMemo(() => {
    let qntPagos = 0, qntPendentes = 0, ganhoTotal = 0
    for (const p of pedidos) {
      if (p.status === 'pago' || p.status === 'enviado' || p.status === 'entregue') {
        qntPagos++
        if (p.comissao) ganhoTotal += p.comissao.valor
      }
      if (p.status === 'pago') qntPendentes++
    }
    return { qntPagos, qntPendentes, ganhoTotal }
  }, [pedidos])

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return pedidos
    return pedidos.filter(p => p.status === filtro)
  }, [pedidos, filtro])

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'pago', label: 'Pago — enviar' },
    { key: 'enviado', label: 'Enviados' },
    { key: 'entregue', label: 'Entregues' },
    { key: 'aguardando_pagamento', label: 'Aguardando' },
    { key: 'cancelado', label: 'Cancelados' },
  ]

  return (
    <div
      className="revendedora-app"
      style={{ minHeight: '100vh', background: 'var(--off)', paddingBottom: 90 }}
    >
      <BannerPagamentoPendente status={statusConta} />
      <header
        style={{
          background: 'white',
          borderBottom: '1px solid var(--rosa-border)',
          padding: '0 20px',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--cinza)' }}
          aria-label="Voltar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div style={{ fontFamily: 'Montserrat', fontSize: 16, fontWeight: 800, color: 'var(--texto)' }}>
          Minhas vendas
        </div>
      </header>

      {/* Resumo: 3 métricas-chave (vendas confirmadas, a enviar, ganho) */}
      <div style={{ background: 'var(--rosa)', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { val: totais.qntPagos.toString(), label: 'Vendas pagas' },
            { val: totais.qntPendentes.toString(), label: 'A enviar' },
            { val: fmtBRL(totais.ganhoTotal), label: 'Você ganhou' },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Montserrat', fontSize: 18, fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: 3 }}>
                {m.val}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.78)' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão verde tiffany pequeno: cadastrar dados bancários. Some quando
          a conta já está vinculada (pagarme_recipient_id preenchido). */}
      {statusConta === 'ativa' && !temConta && (
        <div style={{ padding: '14px 16px 0' }}>
          <button
            onClick={() => router.push('/perfil/recebedor')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#0ABAB5', color: '#fff', border: 'none',
              borderRadius: 24, padding: '9px 16px', cursor: 'pointer',
              fontFamily: 'Montserrat', fontSize: 12.5, fontWeight: 800,
              boxShadow: '0 6px 16px rgba(10,186,181,.32)',
            }}
          >
            💳 Cadastrar dados bancários
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 16px 8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {filtros.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              whiteSpace: 'nowrap',
              padding: '7px 16px',
              borderRadius: 30,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Montserrat',
              cursor: 'pointer',
              background: filtro === f.key ? 'var(--rosa)' : 'white',
              color: filtro === f.key ? 'white' : 'var(--cinza)',
              border: filtro === f.key ? 'none' : '1px solid var(--cinza-light)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--cinza)' }}>
            Carregando...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', marginTop: 8 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💎</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: 14, fontWeight: 700, color: 'var(--texto)', marginBottom: 4 }}>
              {pedidos.length === 0 ? 'Nenhuma venda ainda' : 'Nada neste filtro'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--cinza)' }}>
              {pedidos.length === 0
                ? 'Compartilhe o link da sua loja. Quando uma cliente comprar, o pedido aparece aqui com todos os detalhes.'
                : 'Tente outro filtro.'}
            </div>
          </div>
        ) : (
          filtradas.map(p => {
            const meta = statusMeta(p.status)
            const aberto = expandido === p.id
            const wa = linkWhatsApp(p.cliente.telefone, p.numero_pedido, p.total)
            const enderecoLinha = `${p.endereco.rua}, ${p.endereco.numero}${
              p.endereco.complemento ? ' — ' + p.endereco.complemento : ''
            } · ${p.endereco.bairro} · ${p.endereco.cidade}/${p.endereco.uf} · CEP ${maskCEP(p.endereco.cep)}`
            return (
              <div key={p.id} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                {/* Cabeçalho do card — sempre visível, clica pra expandir */}
                <button
                  onClick={() => setExpandido(aberto ? null : p.id)}
                  aria-expanded={aberto}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: 14, background: 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto)' }}>
                        {p.numero_pedido || 'Pedido'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: 'Montserrat',
                        padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
                        background: meta.bg, color: meta.color,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.cliente.nome || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cinza)' }}>
                      {dataCurta(p.created_at)} · {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'} · {fmtBRL(p.total)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {p.comissao && (
                      <div style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 2 }}>
                        +{fmtBRL(p.comissao.valor)}
                      </div>
                    )}
                    <div style={{ fontSize: 16, color: 'var(--cinza)', transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</div>
                  </div>
                </button>

                {/* Detalhe expandido */}
                {aberto && (
                  <div style={{ borderTop: '1px solid var(--cinza-light)', padding: 14, background: '#FAFAFA' }}>
                    {/* Cliente */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cinza)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                        Cliente
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--texto)', fontWeight: 600, marginBottom: 2 }}>{p.cliente.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 2 }}>{p.cliente.email}</div>
                      {p.cliente.telefone && (
                        <div style={{ fontSize: 12, color: 'var(--cinza)', marginBottom: 2 }}>
                          📱 {maskFone(p.cliente.telefone)}
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#15803D', textDecoration: 'none', fontSize: 11, fontWeight: 700 }}>
                              · Chamar no WhatsApp →
                            </a>
                          )}
                        </div>
                      )}
                      {p.cliente.cpf && (
                        <div style={{ fontSize: 12, color: 'var(--cinza)' }}>CPF: {maskCPF(p.cliente.cpf)}</div>
                      )}
                    </div>

                    {/* Endereço */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cinza)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                        Endereço de entrega
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--texto)', lineHeight: 1.5 }}>
                        {enderecoLinha}
                      </div>
                    </div>

                    {/* Itens */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cinza)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                        Peças
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {p.itens.map((it, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'white', borderRadius: 10, padding: 8 }}>
                            <div style={{ width: 44, height: 44, flexShrink: 0, background: '#F3F4F6', borderRadius: 8, overflow: 'hidden' }}>
                              {it.foto ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={it.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💎</div>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto)', lineHeight: 1.3 }}>{it.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: 2 }}>
                                {it.sku ? `SKU ${it.sku}` : ''}
                                {it.variacao ? `${it.sku ? ' · ' : ''}${it.variacao}` : ''}
                                {it.ref ? `${it.sku || it.variacao ? ' · ' : ''}Ref ${it.ref}` : ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--texto)', fontWeight: 700 }}>
                                {it.quantidade} × {fmtBRL(it.preco)}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--cinza)', marginTop: 1 }}>
                                {fmtBRL(it.quantidade * it.preco)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totais */}
                    <div style={{ background: 'white', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--cinza)', marginBottom: 4 }}>
                        <span>Subtotal</span><span>{fmtBRL(p.subtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--cinza)', marginBottom: 4 }}>
                        <span>Frete</span>
                        <span>{p.frete === 0 ? <span style={{ color: '#15803D', fontWeight: 700 }}>Grátis</span> : fmtBRL(p.frete)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--texto)', fontWeight: 800, paddingTop: 6, borderTop: '1px solid var(--cinza-light)' }}>
                        <span>Total</span><span>{fmtBRL(p.total)}</span>
                      </div>
                      {p.comissao && (
                        <div style={{ marginTop: 10, padding: 10, background: 'var(--teal-pale)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--teal-dark)', fontWeight: 700 }}>
                            Sua comissão ({p.comissao.percentual}%)
                          </span>
                          <span style={{ fontFamily: 'Montserrat', fontSize: 15, fontWeight: 900, color: 'var(--teal-dark)' }}>
                            +{fmtBRL(p.comissao.valor)}
                          </span>
                        </div>
                      )}
                    </div>

                    {p.observacoes && (
                      <div style={{ marginBottom: 10, padding: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                          Observações da cliente
                        </div>
                        <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>{p.observacoes}</div>
                      </div>
                    )}

                    {/* Código de rastreio Correios — revendedora preenche depois de despachar */}
                    <div style={{ marginBottom: 10, padding: 12, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                        📦 Código de rastreio Correios
                      </div>
                      {(() => {
                        const valor = rastreioEdit[p.id] !== undefined ? rastreioEdit[p.id] : (p.codigo_rastreio || '')
                        const salvando = salvandoRastreio === p.id
                        const recemSalvo = rastreioSalvo === p.id
                        return (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              value={valor}
                              onChange={e => setRastreioEdit(prev => ({ ...prev, [p.id]: e.target.value.toUpperCase() }))}
                              placeholder="Ex: BR123456789BR"
                              maxLength={50}
                              disabled={salvando}
                              style={{
                                flex: 1, minWidth: 0,
                                padding: '9px 12px', fontSize: 13,
                                border: '1px solid #BAE6FD', borderRadius: 8,
                                background: 'white', outline: 'none',
                                fontFamily: 'monospace', letterSpacing: '.5px',
                              }}
                            />
                            <button
                              onClick={() => salvarRastreio(p.id, valor)}
                              disabled={salvando || valor === (p.codigo_rastreio || '')}
                              style={{
                                background: recemSalvo ? '#10B981' : '#0369A1',
                                color: 'white', border: 'none',
                                padding: '9px 14px', borderRadius: 8,
                                fontSize: 12, fontWeight: 700,
                                cursor: salvando || valor === (p.codigo_rastreio || '') ? 'not-allowed' : 'pointer',
                                opacity: salvando || valor === (p.codigo_rastreio || '') ? .55 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {salvando ? '...' : recemSalvo ? '✓ Salvo' : 'Salvar'}
                            </button>
                          </div>
                        )
                      })()}
                      {p.codigo_rastreio && (
                        <a
                          href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(p.codigo_rastreio)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#0369A1', fontWeight: 600, textDecoration: 'underline' }}
                        >
                          🔍 Rastrear no site dos Correios →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <BottomNav ativa="vendas" />
    </div>
  )
}
