'use client'
import { useEffect, useState } from 'react'

// Botão "🔄 Atualizar" reutilizável p/ páginas admin. Mostra:
// - "Atualizar" parado
// - "Atualizando..." enquanto a request roda (disabled)
// - "· há Xs/Xmin" depois do último refresh (re-renderiza cada 10s)

type Props = {
  onClick: () => void | Promise<void>
  loading?: boolean
  ultimaAtualizacao?: number | null // Date.now() da última atualização
}

export default function AtualizarBtn({ onClick, loading = false, ultimaAtualizacao }: Props) {
  // Tick a cada 10s só pra forçar re-render do tempo relativo.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 10000)
    return () => clearInterval(id)
  }, [])

  let tempo = ''
  if (ultimaAtualizacao) {
    const diff = Date.now() - ultimaAtualizacao
    if (diff < 5000) tempo = 'agora'
    else if (diff < 60000) tempo = `há ${Math.floor(diff / 1000)}s`
    else tempo = `há ${Math.floor(diff / 60000)}min`
  }

  return (
    <button
      onClick={() => { if (!loading) onClick() }}
      disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'white', border: '1px solid #E5E7EB',
        borderRadius: 10, padding: '8px 14px',
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 600,
        color: '#111827',
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? .6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>🔄</span>
      <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
      {tempo && !loading && (
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>· {tempo}</span>
      )}
    </button>
  )
}
