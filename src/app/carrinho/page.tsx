'use client'
import { useCarrinho, chaveItem, type ItemCarrinho } from '@/contexts/CarrinhoContext'
import { getUltimaLoja } from '@/lib/ultimaLoja'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CalculadoraFrete from '@/components/CalculadoraFrete'

export default function CarrinhoPage() {
  const { itens, alterarQuantidade, remover, limpar } = useCarrinho()
  const router = useRouter()

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  // Seleção estilo Shopee/Shein: o cliente marca o que quer comprar agora e o
  // resto FICA no carrinho. Guardamos os DESmarcados (novos itens já vêm
  // marcados por padrão).
  const [deselecionados, setDeselecionados] = useState<Set<string>>(new Set())
  const estaSelecionado = (i: ItemCarrinho) => !deselecionados.has(chaveItem(i))
  function toggleItem(k: string) {
    setDeselecionados(prev => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }
  const itensSel = itens.filter(estaSelecionado)
  const subtotalSel = itensSel.reduce((a, i) => a + i.preco * i.quantidade, 0)
  const countSel = itensSel.reduce((a, i) => a + i.quantidade, 0)
  const todosMarcados = itens.length > 0 && itensSel.length === itens.length
  function toggleTodos() {
    setDeselecionados(todosMarcados ? new Set(itens.map(chaveItem)) : new Set())
  }
  function finalizar() {
    if (itensSel.length === 0) return
    try {
      sessionStorage.setItem('prata15_checkout_sel', JSON.stringify(itensSel.map(chaveItem)))
    } catch {
      /* ignore */
    }
    router.push('/checkout')
  }
  const totalItens = itens.reduce((a, i) => a + i.quantidade, 0)

  // "Voltar" SEMPRE pra uma loja de revendedora, nunca pra raiz `/` (que é a
  // landing de captação). Prioriza o slug dos itens; senão a última loja
  // visitada (localStorage). Só cai em `/` se o cliente nunca esteve numa loja.
  const [ultimaLoja, setUltimaLojaState] = useState('')
  useEffect(() => { setUltimaLojaState(getUltimaLoja()) }, [])
  const slugLoja = itens[0]?.slugRevendedora || ultimaLoja
  const linkVoltar = slugLoja ? `/loja/${slugLoja}` : '/'

  // Cor da loja (pra os acentos do carrinho seguirem o tema escolhido).
  const [corLoja, setCorLoja] = useState('#1A1A1A')
  useEffect(() => {
    if (!slugLoja) return
    fetch(`/api/loja/${slugLoja}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && /^#[0-9a-fA-F]{6}$/.test(d.cor_tema || '')) setCorLoja(d.cor_tema) })
      .catch(() => {})
  }, [slugLoja])

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: '-apple-system, "Inter", sans-serif' }}>

      <header className="ca-hdr" style={{ background: 'white', borderBottom: '1px solid #EEE' }}>
        <div className="ca-hdr-inner">
          <Link href={linkVoltar} className="ca-hdr-back">
            ← <span className="ca-hdr-back-text">Continuar comprando</span><span className="ca-hdr-back-short">Voltar</span>
          </Link>
          <div className="ca-hdr-title">Carrinho</div>
          <div className="ca-hdr-count">
            {totalItens} {totalItens === 1 ? 'item' : 'itens'}
          </div>
        </div>
      </header>

      <style>{`
        .ca-hdr { padding: 14px 18px; }
        .ca-hdr-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .ca-hdr-back { font-size: 13px; color: #555; text-decoration: none; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
        .ca-hdr-back-text { display: none; }
        .ca-hdr-back-short { display: inline; }
        .ca-hdr-title { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 700; color: #1A1A1A; letter-spacing: -0.3px; text-align: center; flex: 1; min-width: 0; }
        .ca-hdr-count { font-size: 12px; color: #999; white-space: nowrap; flex-shrink: 0; }
        @media (min-width: 560px) {
          .ca-hdr { padding: 20px 24px; }
          .ca-hdr-back-text { display: inline; }
          .ca-hdr-back-short { display: none; }
          .ca-hdr-title { font-size: 20px; }
          .ca-hdr-count { font-size: 13px; }
        }

        .ca-main { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
        .ca-grid { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: start; }
        @media (min-width: 760px) { .ca-grid { grid-template-columns: minmax(0, 1fr) 360px; gap: 32px; } }
        @media (max-width: 640px) { .ca-main { padding: 20px 18px; } .ca-card { padding: 16px !important; } }
        @media (max-width: 400px) { .ca-main { padding: 16px 16px; } }
      `}</style>
      <div className="ca-main">

        {itens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', borderRadius: 16, border: '1px solid #EEE' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
            <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 24, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              Seu carrinho está vazio
            </h2>
            <p style={{ fontSize: 14, color: '#777', marginBottom: 24, lineHeight: 1.6 }}>
              Que tal explorar nossas joias em prata 925?
            </p>
            <Link href={linkVoltar} style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 12, background: '#1A1A1A', color: 'white', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Ver coleção
            </Link>
          </div>
        ) : (
          <div className="ca-grid">

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 8px' }}>
                <button
                  type="button"
                  onClick={toggleTodos}
                  aria-label="Selecionar tudo"
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: todosMarcados ? 'none' : '2px solid #CCC',
                    background: todosMarcados ? corLoja : 'white',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {todosMarcados ? '✓' : ''}
                </button>
                <span style={{ fontSize: 13, color: '#555', fontWeight: 600, cursor: 'pointer' }} onClick={toggleTodos}>
                  Selecionar tudo
                </span>
                <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
                  {countSel} selecionado{countSel === 1 ? '' : 's'}
                </span>
              </div>
              {itens.map(item => (
                <div key={chaveItem(item)} style={{ background: 'white', borderRadius: 12, padding: 16, border: estaSelecionado(item) ? `1px solid ${corLoja}` : '1px solid #EEE', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'border-color .15s' }}>

                  <button
                    type="button"
                    onClick={() => toggleItem(chaveItem(item))}
                    aria-label={estaSelecionado(item) ? 'Desmarcar' : 'Marcar para comprar'}
                    style={{
                      flexShrink: 0, alignSelf: 'center', width: 24, height: 24, borderRadius: '50%',
                      border: estaSelecionado(item) ? 'none' : '2px solid #CCC',
                      background: estaSelecionado(item) ? corLoja : 'white',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {estaSelecionado(item) ? '✓' : ''}
                  </button>

                  <div style={{ width: 80, height: 80, flexShrink: 0, background: '#F5F5F5', borderRadius: 8, overflow: 'hidden' }}>
                    {item.foto ? (
                      <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💎</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 14, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 4 }}>
                      {item.nome}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: item.variacao ? 4 : 10 }}>
                      SKU: {item.sku}
                    </div>
                    {item.variacao && (
                      <div style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 600, marginBottom: 4 }}>
                        {item.variacao}
                      </div>
                    )}
                    {item.ref && (
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>
                        Ref: {item.ref}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #EEE', borderRadius: 8, background: '#FAFAFA' }}>
                        <button
                          onClick={() => alterarQuantidade(chaveItem(item), item.quantidade - 1)}
                          style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#555' }}
                          aria-label="Diminuir quantidade"
                        >
                          −
                        </button>
                        <div style={{ minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                          {item.quantidade}
                        </div>
                        <button
                          onClick={() => alterarQuantidade(chaveItem(item), item.quantidade + 1)}
                          style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#555' }}
                          aria-label="Aumentar quantidade"
                        >
                          +
                        </button>
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
                        {formatBRL(item.preco * item.quantidade)}
                      </div>
                    </div>

                    <button
                      onClick={() => remover(chaveItem(item))}
                      style={{ marginTop: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#DC2626', textDecoration: 'underline' }}
                    >
                      Remover
                    </button>
                  </div>

                </div>
              ))}

              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar o carrinho?')) limpar()
                }}
                style={{ marginTop: 8, padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#999', textDecoration: 'underline', textAlign: 'center' }}
              >
                Limpar carrinho
              </button>
            </div>

            <div className="ca-card" style={{ position: 'sticky', top: 24, background: 'white', borderRadius: 16, padding: 24, border: '1px solid #EEE' }}>
              <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>
                Resumo
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#555', marginBottom: 16 }}>
                <span>Subtotal ({countSel} {countSel === 1 ? 'item' : 'itens'})</span>
                <span>{formatBRL(subtotalSel)}</span>
              </div>

              {/* Calculadora de frete: cliente vê o preço real de PAC/SEDEX
                  ainda dentro do carrinho. Confirma escolha no checkout. */}
              <div style={{ marginBottom: 16 }}>
                <CalculadoraFrete
                  subtotal={subtotalSel}
                  qntItens={Math.max(1, countSel)}
                  cor={corLoja}
                />
              </div>

              <div style={{ borderTop: '1px solid #EEE', paddingTop: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Total <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>(sem frete)</span></span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>{formatBRL(subtotalSel)}</span>
              </div>

              <div style={{ fontSize: 12, color: '#777', marginBottom: 16, textAlign: 'center' }}>
                ou 6x de {formatBRL(subtotalSel / 6)} sem juros
              </div>

              <button
                type="button"
                onClick={finalizar}
                disabled={countSel === 0}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '16px 20px', borderRadius: 12,
                  background: countSel === 0 ? '#CCC' : corLoja, color: 'white',
                  fontSize: 15, fontWeight: 600, textDecoration: 'none',
                  border: 'none', cursor: countSel === 0 ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {countSel === 0 ? 'Selecione um item' : `Finalizar compra (${countSel})`}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}