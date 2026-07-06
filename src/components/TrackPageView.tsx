'use client'

// Dispara uma visita pra /api/track ao montar.
// Gera uma sessão anônima no sessionStorage pra contar visitantes únicos
// sem identificar a pessoa. Best-effort: se falhar não trava nada.

import { useEffect } from 'react'

function gerarSessao(): string {
  try {
    const existe = sessionStorage.getItem('vstr')
    if (existe) return existe
    const novo = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('vstr', novo)
    return novo
  } catch {
    return ''
  }
}

export default function TrackPageView({ pagina }: { pagina: string }) {
  useEffect(() => {
    // LGPD: só tracker se a visitante aceitou cookies de analytics.
    // Cookies essenciais (sessão) continuam funcionando sem consent.
    try {
      if (localStorage.getItem('cookies-aceitos') !== 'sim') return
    } catch { return }

    const sessao = gerarSessao()
    const referrer = (typeof document !== 'undefined' ? document.referrer : '') || ''
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagina, sessao, referrer }),
      keepalive: true,
    }).catch(() => { /* silencioso */ })
  }, [pagina])
  return null
}
