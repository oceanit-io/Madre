'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Página puente: "Minha loja" (no bottom nav) leva a revendedora pra
// personalizar a vitrine. A vitrine pública (cliente-facing) é aberta
// pelo botão "Ver minha loja" dentro de /configurar-loja.
export default function MinhaLojaPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/configurar-loja') }, [router])
  return (
    <div className="revendedora-app" style={{ minHeight: '100vh', background: 'var(--off)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--rosa-border)', borderTopColor: 'var(--rosa)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: 'var(--cinza)' }}>Abrindo personalização...</div>
      </div>
    </div>
  )
}
