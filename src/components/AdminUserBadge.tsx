'use client'

// Badge fixo no canto superior direito de toda página /admin/*.
// Busca /api/admin/me. Se autenticado: mostra "Logado: X" + logout.
// Se não autenticado (tela de PIN): some.

import { useEffect, useState } from 'react'

const LABEL: Record<string, { nome: string; cor: string }> = {
  gabby: { nome: 'Gabby', cor: '#E8396A' },
  anderson: { nome: 'Anderson', cor: '#6366F1' },
  escritorio: { nome: 'Escritório', cor: '#22C55E' },
  master: { nome: 'Master', cor: '#9333EA' },
  viewer: { nome: 'Visualização', cor: '#0EA5E9' },
}

export default function AdminUserBadge() {
  const [quem, setQuem] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setQuem(d?.quem || null); setRole(d?.role || null) })
      .catch(() => setQuem(null))
  }, [])

  if (!quem) return null
  const info = LABEL[quem] || { nome: quem, cor: '#475569' }
  const somenteLeitura = role === 'viewer'

  async function sair() {
    try {
      await fetch('/api/admin/login', { method: 'DELETE', credentials: 'include' })
    } catch { /* */ }
    window.location.href = '/admin'
  }

  return (
    <div
      className="admin-user-badge"
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#fff',
        border: `1px solid ${info.cor}33`,
        borderLeft: `4px solid ${info.cor}`,
        borderRadius: 10,
        padding: '6px 10px 6px 12px',
        boxShadow: '0 2px 8px rgba(15,23,42,.08)',
        fontFamily: 'Montserrat, "Inter", system-ui, sans-serif',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ color: '#64748B', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Logado como
        </span>
        <span style={{ color: info.cor, fontWeight: 800, fontSize: 13 }}>
          {info.nome}
        </span>
        {somenteLeitura && (
          <span style={{ color: '#0EA5E9', fontWeight: 700, fontSize: 9.5, marginTop: 1 }}>
            👁 Somente leitura
          </span>
        )}
      </div>
      <button
        onClick={sair}
        style={{
          background: 'transparent',
          border: `1px solid ${info.cor}66`,
          color: info.cor,
          padding: '3px 8px',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        title="Sair"
      >
        Sair
      </button>
    </div>
  )
}
