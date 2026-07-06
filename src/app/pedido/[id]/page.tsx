'use client'

// Página de ACOMPANHAMENTO do pedido (cliente final). Pública: o id é um
// UUID que veio no e-mail/confirmação do cliente. Mostra:
//   - linha do tempo do status (Pedido → Pago → Enviado → Entregue)
//   - itens + total
//   - quando enviado: código de rastreio + EVENTOS REAIS dos Correios
//     (via /api/rastreio) + link público.
//   - contato da revendedora (WhatsApp).

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Item = { nome?: string; preco?: number; quantidade?: number; foto?: string }
type Pedido = {
  numero_pedido: string
  status: string
  cliente_nome: string | null
  total: number | string
  itens: unknown
  codigo_rastreio: string | null
  endereco_cidade: string | null
  endereco_uf: string | null
  revendedora?: { nome: string; nome_loja: string | null; whatsapp: string; subdominio: string } | null
}
type Evento = { data: string; status: string; local: string | null }

const PASSOS = [
  { key: 'pago', label: 'Pagamento', icon: '💳' },
  { key: 'enviado', label: 'Enviado', icon: '📦' },
  { key: 'entregue', label: 'Entregue', icon: '🏠' },
]
// Índice do status atual na linha do tempo.
function nivel(status: string): number {
  if (status === 'entregue') return 3
  if (status === 'enviado') return 2
  if (status === 'pago') return 1
  return 0 // aguardando_pagamento / outros
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AcompanharPedidoPage({ params }: { params: { id: string } }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [linkCorreios, setLinkCorreios] = useState<string>('')
  const [rastLoading, setRastLoading] = useState(false)

  useEffect(() => {
    let vivo = true
    async function carregar() {
      try {
        const r = await fetch(`/api/pedidos/${params.id}`)
        if (!r.ok) { if (vivo) { setNaoEncontrado(true); setLoading(false) } ; return }
        const data = await r.json()
        if (vivo) setPedido(data)
      } catch { if (vivo) setNaoEncontrado(true) }
      if (vivo) setLoading(false)
    }
    carregar()
    return () => { vivo = false }
  }, [params.id])

  // Busca os eventos dos Correios quando há código de rastreio.
  useEffect(() => {
    const cod = pedido?.codigo_rastreio?.trim()
    if (!cod) return
    let vivo = true
    setRastLoading(true)
    fetch(`/api/rastreio/${encodeURIComponent(cod)}`)
      .then(r => r.json())
      .then(j => { if (vivo) { setEventos(Array.isArray(j.eventos) ? j.eventos : []); setLinkCorreios(j.link || '') } })
      .catch(() => { if (vivo) setEventos([]) })
      .finally(() => { if (vivo) setRastLoading(false) })
    return () => { vivo = false }
  }, [pedido?.codigo_rastreio])

  if (loading) {
    return (
      <div style={wrap}>
        <div style={{ color: '#999', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Carregando pedido…</div>
      </div>
    )
  }

  if (naoEncontrado || !pedido) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>Pedido não encontrado</h1>
          <p style={{ fontSize: 14, color: '#777' }}>Confira o link do seu e-mail de confirmação.</p>
        </div>
      </div>
    )
  }

  const itens: Item[] = Array.isArray(pedido.itens)
    ? (pedido.itens as Item[])
    : (() => { try { return JSON.parse(String(pedido.itens || '[]')) } catch { return [] } })()
  const n = nivel(pedido.status)
  const cancelado = pedido.status === 'cancelado'
  const wa = (pedido.revendedora?.whatsapp || '').replace(/\D/g, '')
  const waLink = wa
    ? `https://wa.me/55${wa}?text=${encodeURIComponent(`Olá! Sobre meu pedido ${pedido.numero_pedido} 💎`)}`
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#999', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
            {pedido.revendedora?.nome_loja || 'Acompanhe seu pedido'}
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: '6px 0 0' }}>
            Pedido {pedido.numero_pedido}
          </h1>
        </div>

        {/* Timeline de status */}
        <div style={card}>
          {cancelado ? (
            <div style={{ textAlign: 'center', color: '#B91C1C', fontWeight: 700, fontSize: 15, padding: '8px 0' }}>
              ⚠️ Pedido cancelado
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              {/* linha de fundo */}
              <div style={{ position: 'absolute', top: 18, left: 28, right: 28, height: 3, background: '#EEE', zIndex: 0 }} />
              <div style={{ position: 'absolute', top: 18, left: 28, height: 3, background: '#1FAD52', zIndex: 0, width: `calc(${(Math.max(0, n - 1) / (PASSOS.length - 1)) * 100}% - ${n <= 1 ? 0 : 0}px)`, maxWidth: 'calc(100% - 56px)', transition: 'width .4s' }} />
              {PASSOS.map((p, i) => {
                const feito = n >= i + 1
                return (
                  <div key={p.key} style={{ position: 'relative', zIndex: 1, textAlign: 'center', flex: 1 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', margin: '0 auto',
                      background: feito ? '#1FAD52' : '#fff', border: `2px solid ${feito ? '#1FAD52' : '#DDD'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                      filter: feito ? 'none' : 'grayscale(1) opacity(.5)',
                    }}>{p.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: feito ? '#1A1A1A' : '#AAA', marginTop: 6 }}>{p.label}</div>
                  </div>
                )
              })}
            </div>
          )}
          {!cancelado && n === 0 && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link href={`/pedido/${params.id}/aguardando-pagamento`} style={{ display: 'inline-block', background: '#DC2626', color: '#fff', textDecoration: 'none', fontWeight: 800, padding: '12px 24px', borderRadius: 10, fontSize: 14 }}>
                💳 Pagar agora
              </Link>
            </div>
          )}
        </div>

        {/* Rastreamento Correios */}
        {(pedido.status === 'enviado' || pedido.status === 'entregue') && (
          <div style={card}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 10 }}>
              📦 Rastreamento
            </div>
            {pedido.codigo_rastreio ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#F5F5F5', borderRadius: 10, padding: '10px 12px', marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#999' }}>Código</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{pedido.codigo_rastreio}</div>
                  </div>
                  {linkCorreios && (
                    <a href={linkCorreios} target="_blank" rel="noopener noreferrer" style={{ background: '#005DAA', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 8 }}>
                      Ver nos Correios ↗
                    </a>
                  )}
                </div>
                {rastLoading && <div style={{ fontSize: 13, color: '#999' }}>Buscando atualizações…</div>}
                {!rastLoading && eventos && eventos.length > 0 && (
                  <div style={{ borderLeft: '2px solid #E5E5E5', paddingLeft: 14, marginLeft: 4 }}>
                    {eventos.map((e, i) => (
                      <div key={i} style={{ position: 'relative', paddingBottom: i < eventos.length - 1 ? 14 : 0 }}>
                        <div style={{ position: 'absolute', left: -21, top: 3, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#1FAD52' : '#CCC' }} />
                        <div style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 600, color: '#1A1A1A' }}>{e.status}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{[fmtData(e.data), e.local].filter(Boolean).join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {!rastLoading && eventos && eventos.length === 0 && (
                  <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5 }}>
                    Seu pedido foi postado. Os Correios atualizam o trajeto em algumas horas — toque em “Ver nos Correios” pra acompanhar.
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#777' }}>O código de rastreio aparece aqui assim que o pedido for postado.</div>
            )}
          </div>
        )}

        {/* Itens */}
        <div style={card}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 10 }}>Resumo</div>
          {itens.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < itens.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              {it.foto && <img src={it.foto} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{it.nome}</div>
                <div style={{ fontSize: 12, color: '#999' }}>Qtd: {it.quantidade || 1}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{fmtBRL(Number(it.preco || 0) * Number(it.quantidade || 1))}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid #EEE' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A' }}>{fmtBRL(Number(pedido.total || 0))}</span>
          </div>
          {(pedido.endereco_cidade || pedido.endereco_uf) && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              Entrega em {pedido.endereco_cidade}{pedido.endereco_cidade && pedido.endereco_uf ? '/' : ''}{pedido.endereco_uf}
            </div>
          )}
        </div>

        {/* Contato revendedora */}
        {waLink && (
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#1FAD52', color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 12, fontSize: 14 }}>
              Falar com {(pedido.revendedora?.nome || '').split(' ')[0] || 'a loja'} no WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #EEE', borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: '0 2px 10px rgba(0,0,0,.03)' }
