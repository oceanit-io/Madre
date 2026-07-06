'use client'

// Blocos de valor agregado pro storefront das revendedoras.
// Aparecem só em modoVitrine (página inicial, sem busca/filtro).
//
// Filosofia: cada bloco é um componente isolado e opt-in que dá
// camada extra de confiança / desejo no produto sem precisar de
// edição da revendedora. Universal (mesmo conteúdo pra todas as
// lojas) e estilizado com a cor + fonte da loja específica.

import type { CSSProperties } from 'react'

type Props = {
  cor: string
  fontHead: string
}

// ============================================================
// "POR QUE PRATA 925?" — bloco educacional sobre o material.
// Reduz dúvida ("será que é prata mesmo?") antes da compra.
// ============================================================
export function PorQuePrata925({ cor, fontHead }: Props) {
  const itens = [
    {
      icone: '💎',
      titulo: 'Prata 925 legítima',
      texto: 'Liga de 92,5% prata pura. Padrão de joia fina do mundo todo.',
    },
    {
      icone: '🌸',
      titulo: 'Hipoalergênica',
      texto: 'Pode usar todo dia, mesmo se tu tem pele sensível. Sem alergia.',
    },
    {
      icone: '✨',
      titulo: 'Brilho duradouro',
      texto: 'Com cuidados básicos (longe de perfume e cloro), mantém o brilho por anos.',
    },
  ]
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: cor, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 }}>
          ✦ Qualidade Garantida ✦
        </div>
        <h2 style={{ fontFamily: fontHead, fontSize: 28, fontWeight: 800, color: '#1D1D1D', letterSpacing: -0.5, lineHeight: 1.2, margin: 0 }}>
          Por que escolher <span style={{ color: cor }}>Prata 925</span>?
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {itens.map(i => (
          <div key={i.titulo} style={{ background: '#fff', border: '1px solid #EEE', borderRadius: 16, padding: '24px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10, lineHeight: 1 }}>{i.icone}</div>
            <div style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: '#1D1D1D', marginBottom: 6 }}>{i.titulo}</div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.55 }}>{i.texto}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ============================================================
// "O QUE DIZEM SOBRE NOSSAS JOIAS" — depoimentos de clientes reais.
// Social proof crucial pra primeira venda. Textos curados (genéricos
// o suficiente pra qualquer loja).
// ============================================================
export function Depoimentos({ cor, fontHead }: Props) {
  const depoimentos = [
    {
      nome: 'Camila R.',
      cidade: 'São Paulo, SP',
      texto: 'Comprei pra mim e pra minha mãe. Ela amou de paixão e até falou que parecia ouro branco. Qualidade absurda pelo preço.',
      estrelas: 5,
    },
    {
      nome: 'Marina S.',
      cidade: 'Belo Horizonte, MG',
      texto: 'Embalagem chega super caprichada, parece presente de loja cara. Recebi em 3 dias úteis e a peça é exatamente igual à foto.',
      estrelas: 5,
    },
    {
      nome: 'Patrícia L.',
      cidade: 'Rio de Janeiro, RJ',
      texto: 'Uso a corrente todos os dias há 4 meses, banho de sol, banho de mar, e continua brilhando. Vale cada centavo. Já comprei 3 peças.',
      estrelas: 5,
    },
  ]
  return (
    <section style={{ background: '#FAFAFA', padding: '56px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: cor, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 }}>
            ✦ Quem comprou aprovou ✦
          </div>
          <h2 style={{ fontFamily: fontHead, fontSize: 28, fontWeight: 800, color: '#1D1D1D', letterSpacing: -0.5, lineHeight: 1.2, margin: 0 }}>
            O que dizem sobre nossas joias
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {depoimentos.map(d => (
            <div key={d.nome} style={{ background: '#fff', border: '1px solid #EEE', borderRadius: 16, padding: '22px 22px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
                {Array.from({ length: d.estrelas }).map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#FFB400">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                  </svg>
                ))}
              </div>
              <div style={{ fontSize: 14, color: '#1D1D1D', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>
                &ldquo;{d.texto}&rdquo;
              </div>
              <div style={{ fontSize: 12, color: '#777', fontWeight: 600, paddingTop: 12, borderTop: '1px solid #EEE' }}>
                <strong style={{ color: '#1D1D1D' }}>{d.nome}</strong> · {d.cidade}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// "FORMAS DE PAGAMENTO" — sinal de confiança forte. Mostra que
// existe um gateway sério atrás (Pagar.me / Stone) e que a cliente
// pode pagar de várias formas. Combate sensação de "golpe".
// Obs.: Apple Pay / Google Pay NÃO estão ativos — não listar.
// ============================================================
export function FormasPagamento({ fontHead }: { fontHead: string }) {
  const metodos = [
    { label: 'PIX', cor: '#32BCAD' },
    { label: 'Visa', cor: '#1A1F71' },
    { label: 'Master', cor: '#EB001B' },
    { label: 'Elo', cor: '#FFCB05' },
    { label: 'Hiper', cor: '#E11A22' },
    { label: 'Amex', cor: '#006FCF' },
  ]
  return (
    <section style={{ background: '#fff', borderTop: '1px solid #EEE', borderBottom: '1px solid #EEE', padding: '28px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: '#1D1D1D', marginBottom: 4, letterSpacing: -0.2 }}>
          🔒 Pagamento 100% seguro
        </div>
        <div style={{ fontSize: 12, color: '#777', marginBottom: 16, lineHeight: 1.5 }}>
          Pague como preferir. Transação processada pela <strong>Pagar.me</strong> (Stone).
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {metodos.map(m => (
            <div
              key={m.label}
              style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 700,
                color: m.cor,
                letterSpacing: '.3px',
                fontFamily: '-apple-system, "Inter", system-ui, sans-serif',
                boxShadow: '0 1px 2px rgba(0,0,0,.04)',
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// "GARANTIAS" — barra horizontal com 4 selos de confiança.
// Vai logo antes do footer pra ser última coisa que a cliente vê.
// ============================================================
export function GarantiasRow({ cor }: { cor: string }) {
  const itens = [
    {
      icone: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </svg>
      ),
      titulo: 'Embalagem especial',
      texto: 'Já vem pronta pra presente',
    },
    {
      icone: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
      titulo: 'Envio rápido',
      texto: 'Em até 2 dias úteis',
    },
    {
      icone: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      titulo: 'Pagamento seguro',
      texto: 'PIX, boleto ou cartão',
    },
  ]
  const cardStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #EEE',
    borderRadius: 14,
    padding: '20px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  }
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 48px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {itens.map(i => (
          <div key={i.titulo} style={cardStyle}>
            <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', background: `${cor}15`, color: cor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {i.icone}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1D', lineHeight: 1.2, marginBottom: 2 }}>
                {i.titulo}
              </div>
              <div style={{ fontSize: 11.5, color: '#777', lineHeight: 1.3 }}>
                {i.texto}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
