'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Banner de consentimento de cookies — conformidade LGPD.
//
// Comportamento:
//   - Aparece na primeira visita se ainda não há decisão registrada.
//   - Salva escolha em localStorage ('cookies-aceitos' = 'sim' | 'nao').
//   - "Aceitar" → libera analytics (TrackPageView).
//   - "Só essenciais" → bloqueia analytics, só cookies de sessão.
//   - Link pra política completa.
//
// Quem decide se trackear: o componente TrackPageView checa o valor
// antes de fazer fetch pra /api/track. Sem essa flag não loga visita.

export function temConsentimentoAnalytics(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('cookies-aceitos') === 'sim'
}

export default function CookieBanner() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dec = localStorage.getItem('cookies-aceitos')
    if (!dec) {
      // Espera 1.5s pra não ser a primeira coisa que aparece
      const t = setTimeout(() => setMostrar(true), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  function decidir(escolha: 'sim' | 'nao') {
    try {
      localStorage.setItem('cookies-aceitos', escolha)
      localStorage.setItem('cookies-decidido-em', new Date().toISOString())
    } catch { /* sessão privada bloqueia, tudo bem */ }
    setMostrar(false)
  }

  if (!mostrar) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: 520,
        margin: '0 auto',
        background: 'white',
        border: '1px solid #ffd6e6',
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 10px 30px rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.04)',
        fontFamily: '-apple-system,"Inter",system-ui,sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>🍪</span>
        <strong style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 14, color: '#1D1D1D' }}>
          A gente usa cookies
        </strong>
      </div>
      <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 12 }}>
        Usamos cookies essenciais pra manter teu login funcionando e cookies de analytics
        anônimo pra entender o tráfego do site. Tu pode aceitar ou só os essenciais.
        Veja mais na <Link href="/privacidade" style={{ color: '#ff7db4', fontWeight: 600, textDecoration: 'underline' }}>Política de Privacidade</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => decidir('sim')}
          style={{
            flex: '1 1 140px',
            padding: '10px 14px',
            background: '#ff7db4',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ✓ Aceitar todos
        </button>
        <button
          onClick={() => decidir('nao')}
          style={{
            flex: '1 1 140px',
            padding: '10px 14px',
            background: 'transparent',
            color: '#777',
            border: '1px solid #DDD',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Só essenciais
        </button>
      </div>
    </div>
  )
}
