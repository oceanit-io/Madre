'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUltimaLoja } from '@/lib/ultimaLoja'
import { brand } from '@/lib/brand'

type ItemPedido = {
  id: string
  sku: string
  nome: string
  preco: number
  foto: string
  quantidade: number
}

type Pedido = {
  id: string
  numero_pedido: string
  status: string
  cliente_nome: string
  cliente_email: string
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
  slug_revendedora: string | null
  pagbank_link: string | null
  codigo_rastreio: string | null
  revendedora: {
    nome: string
    nome_loja: string | null
    whatsapp: string
    subdominio: string
  } | null
}

function formatBRL(val: number) {
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type DadosPix = {
  orderId: string
  chargeId: string
  qrCodeUrl: string
  copiaECola: string
  expiraEm: string
}

export default function AguardandoPagamentoPage({ params }: { params: { id: string } }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [pix, setPix] = useState<DadosPix | null>(null)
  const [pixLoading, setPixLoading] = useState(false)
  const [pixErro, setPixErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  // Destino de "voltar" quando não há loja no pedido: a última loja visitada,
  // nunca a raiz `/` (landing de captação).
  const [voltarHome, setVoltarHome] = useState('/')
  useEffect(() => { const s = getUltimaLoja(); if (s) setVoltarHome(`/loja/${s}`) }, [])

  async function gerarPix() {
    if (pixLoading) return
    setPixLoading(true)
    setPixErro('')
    try {
      const res = await fetch(`/api/pedidos/${params.id}/pix`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPixErro(data?.erro || 'Não foi possível gerar o PIX agora. Tente o cartão.')
      } else {
        setPix(data as DadosPix)
      }
    } catch {
      setPixErro('Erro de rede. Tente novamente.')
    }
    setPixLoading(false)
  }

  async function copiarCodigo() {
    if (!pix?.copiaECola) return
    try {
      await navigator.clipboard.writeText(pix.copiaECola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetch(`/api/pedidos/${params.id}`)
      .then(async res => {
        if (!res.ok) {
          setErro(true)
          return
        }
        const data = await res.json()
        setPedido(data)
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }, [params.id])

  // Enquanto está aguardando pagamento, refaz a consulta a cada 5s. Quando o
  // webhook da Pagar.me marcar 'pago', a tela atualiza sozinha pro estado de
  // sucesso (o cliente pagou por PIX no banco e volta pra cá).
  useEffect(() => {
    if (!pedido || pedido.status !== 'aguardando_pagamento') return
    const t = setInterval(() => {
      fetch(`/api/pedidos/${params.id}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d && d.status) setPedido(d) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [pedido?.status, params.id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ fontSize: 13, color: '#999', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
          Carregando...
        </div>
      </div>
    )
  }

  if (erro || !pedido) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26, fontWeight: 700, marginBottom: 8, color: '#1A1A1A' }}>
            Pedido não encontrado
          </h1>
          <Link href={voltarHome} style={{ color: '#555', fontSize: 14, textDecoration: 'underline' }}>
            ← Voltar à loja
          </Link>
        </div>
      </div>
    )
  }

  const pago = ['pago', 'enviado', 'entregue'].includes(pedido.status)
  const rev = pedido.revendedora
  let linkWhatsApp: string | null = null
  if (rev?.whatsapp) {
    const whatsappLimpo = rev.whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Olá ${rev.nome.split(' ')[0]}! 💎\n\nAcabei de fazer o pedido *${pedido.numero_pedido}* na loja.\nTotal: ${formatBRL(pedido.total)}\n\nGostaria de confirmar o pagamento. Pode me ajudar?`
    )
    linkWhatsApp = `https://wa.me/55${whatsappLimpo}?text=${msg}`
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: '-apple-system, "Inter", sans-serif' }}>
      <header className="ag-hdr" style={{ background: 'white', borderBottom: '1px solid #EEE' }}>
        <div className="ag-hdr-inner" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 17, fontWeight: 700, color: '#1A1A1A', letterSpacing: -0.3, lineHeight: 1.1 }}>
            {brand.nome}
          </div>
        </div>
      </header>
      <style>{`
        .ag-hdr { padding: 16px 18px; }
        .ag-main { max-width: 720px; margin: 0 auto; padding: 24px 18px 60px; }
        .ag-card { background: white; border-radius: 12px; padding: 16px; border: 1px solid #EEE; margin-bottom: 16px; }
        @media (min-width: 560px) { .ag-hdr { padding: 20px 24px; } .ag-main { padding: 32px 20px 60px; } .ag-card { padding: 24px; margin-bottom: 20px; } }
      `}</style>

      <div className="ag-main">
        {/* Confirmação */}
        <div className="ag-card" style={{ textAlign: 'center', padding: 'clamp(16px, 5vw, 32px)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: pago ? '#DCFCE7' : '#FFF7ED',
            color: pago ? '#15803D' : '#C2410C', fontSize: 28, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            {pago ? '✓' : '●'}
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 24, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
            {pago ? 'Pagamento confirmado! 🎉' : 'Pedido criado com sucesso!'}
          </h1>
          <p style={{ fontSize: 14, color: '#777', marginBottom: 16 }}>
            {pago
              ? 'Recebemos seu pagamento. Seu pedido já está em preparação 💎'
              : 'Anote o número do seu pedido:'}
          </p>
          <div style={{
            display: 'inline-block', background: '#FAFAFA', border: '1px solid #EEE',
            borderRadius: 12, padding: '12px 20px', fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: 0.5,
          }}>
            {pedido.numero_pedido}
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={{
              display: 'inline-block',
              background: pago ? '#DCFCE7' : '#FFF7ED',
              color: pago ? '#15803D' : '#C2410C',
              fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 999,
            }}>
              {pago ? '● Pago' : '● Aguardando pagamento'}
            </span>
          </div>

          {/* Código de rastreio Correios — aparece quando a revendedora ou
              o admin já preencheu. Cliente clica e cai direto no site dos
              Correios com o objeto pré-carregado. */}
          {pago && pedido.codigo_rastreio && (
            <div style={{
              marginTop: 22,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 12,
              padding: '18px 20px',
              textAlign: 'left',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#1E40AF',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
              }}>
                📦 Pedido enviado
              </div>
              <div style={{ fontSize: 13, color: '#1E3A8A', marginBottom: 10 }}>
                Código de rastreio Correios:
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 16, fontWeight: 800,
                color: '#1E40AF', background: '#fff', border: '1px solid #BFDBFE',
                borderRadius: 8, padding: '10px 14px', display: 'inline-block',
                letterSpacing: 1,
              }}>
                {pedido.codigo_rastreio}
              </div>
              <a
                href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(pedido.codigo_rastreio)}`}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  display: 'block', marginTop: 12,
                  background: '#1E40AF', color: '#fff',
                  padding: '11px 16px', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                🔍 Rastrear no site dos Correios →
              </a>
            </div>
          )}
        </div>

        {/* Sem link de pagamento online: orienta a combinar pelo WhatsApp. */}
        {!pago && !pedido.pagbank_link && (
          <div style={{ background: '#FFF8E1', border: '1px solid #FDE68A', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: '#92400E', lineHeight: 1.6, margin: 0 }}>
              💎 Para confirmar o pagamento, entre em contato com a revendedora pelo WhatsApp.
            </p>
          </div>
        )}

        {/* Pagamento online — 2 opções: PIX direto (split inline) ou cartão (paymentlink Pagar.me) */}
        {!pago && (
          <div style={{ marginBottom: 20 }}>
            {/* Quando JÁ geramos o PIX: mostra QR + copia e cola in-page */}
            {pix && (
              <div className="ag-card" style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
                  Pague com PIX
                </div>
                <div style={{ fontSize: 12, color: '#777', marginBottom: 16 }}>
                  Aponte o app do seu banco pro QR code ou cole o código abaixo.
                </div>
                <div style={{ background: 'white', display: 'inline-block', padding: 8, borderRadius: 12, border: '1px solid #EEE' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pix.qrCodeUrl}
                    alt="QR Code PIX"
                    style={{ width: 220, height: 220, display: 'block' }}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      background: '#FAFAFA', border: '1px solid #EEE', borderRadius: 10,
                      padding: 12, fontFamily: 'monospace', fontSize: 10, color: '#444',
                      wordBreak: 'break-all', textAlign: 'left', maxHeight: 90, overflow: 'auto',
                    }}
                  >
                    {pix.copiaECola}
                  </div>
                  <button
                    type="button"
                    onClick={copiarCodigo}
                    style={{
                      marginTop: 10, width: '100%', padding: '12px 20px', borderRadius: 12,
                      background: copiado ? '#15803D' : '#1A1A1A', color: 'white', border: 'none',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {copiado ? '✓ Código copiado!' : '📋 Copiar código PIX'}
                  </button>
                </div>
                <div style={{ marginTop: 14, fontSize: 11, color: '#999' }}>
                  Após pagar, esta página atualiza sozinha.
                </div>
              </div>
            )}

            {/* Botões de pagamento (esconde o do PIX depois que já gerou) */}
            {!pix && (
              <button
                type="button"
                onClick={gerarPix}
                disabled={pixLoading}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '16px 20px', borderRadius: 12,
                  background: '#089C82', color: 'white', border: 'none',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxSizing: 'border-box', marginBottom: 10,
                }}
              >
                {pixLoading ? 'Gerando PIX...' : '⚡ Pagar com PIX (recebe na hora)'}
              </button>
            )}

            {pixErro && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 10 }}>
                {pixErro}
              </div>
            )}

            {pedido.pagbank_link && (
              <Link
                href={pedido.pagbank_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '16px 20px', borderRadius: 12,
                  background: '#1A1A1A', color: 'white',
                  fontSize: 15, fontWeight: 700, textDecoration: 'none',
                  boxSizing: 'border-box',
                }}
              >
                💳 Pagar com cartão
              </Link>
            )}
          </div>
        )}

        {/* WhatsApp: SÓ aparece como fallback quando NÃO há link de pagamento
            online (cenário raro: Pagar.me caiu na criação). Quando o link
            existe, escondemos o botão pra não desviar o cliente do checkout.
            Pós-pagamento o e-mail de confirmação já traz o contato. */}
        {linkWhatsApp && !pedido.pagbank_link && !pago && (
          <Link
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              padding: '16px 20px', borderRadius: 12,
              background: '#1A1A1A',
              color: 'white',
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              boxSizing: 'border-box', marginBottom: 20,
            }}
          >
            Chamar no WhatsApp
          </Link>
        )}

        {/* Resumo */}
        <div className="ag-card">
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>
            Resumo do pedido
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {pedido.itens.map((item, i) => (
              <div key={`${item.id}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, flexShrink: 0, background: '#F5F5F5', borderRadius: 8, overflow: 'hidden' }}>
                  {item.foto ? (
                    <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💎</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
                    {item.nome}
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    SKU: {item.sku} · Qtd: {item.quantidade}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                  {formatBRL(item.preco * item.quantidade)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #EEE', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555', marginBottom: 8 }}>
              <span>Subtotal</span>
              <span>{formatBRL(pedido.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555', marginBottom: 12 }}>
              <span>Frete</span>
              {Number(pedido.frete) === 0 ? (
                <span style={{ color: '#15803D', fontWeight: 700 }}>Grátis</span>
              ) : (
                <span>{formatBRL(pedido.frete)}</span>
              )}
            </div>
            <div style={{ borderTop: '1px solid #EEE', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Total</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>{formatBRL(pedido.total)}</span>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="ag-card">
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 12 }}>
            Endereço de entrega
          </div>
          <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: '#1A1A1A' }}>{pedido.cliente_nome}</div>
            <div>
              {pedido.endereco_rua}, {pedido.endereco_numero}
              {pedido.endereco_complemento ? ` — ${pedido.endereco_complemento}` : ''}
            </div>
            <div>{pedido.endereco_bairro}</div>
            <div>
              {pedido.endereco_cidade} / {pedido.endereco_uf} · CEP {pedido.endereco_cep}
            </div>
          </div>
        </div>

        {(() => {
          const lojaSlug = pedido.slug_revendedora || pedido.revendedora?.subdominio || ''
          return lojaSlug ? (
            <div style={{ marginTop: 28 }}>
              <Link
                href={`/loja/${lojaSlug}`}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '15px 20px', borderRadius: 12,
                  background: 'white', color: '#1A1A1A',
                  border: '1px solid #1A1A1A',
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  boxSizing: 'border-box',
                }}
              >
                ← Continuar comprando na loja
              </Link>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <Link href={voltarHome} style={{ fontSize: 13, color: '#777', textDecoration: 'underline' }}>
                Voltar à loja
              </Link>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
