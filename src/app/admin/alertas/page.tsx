'use client'

// /admin/alertas — lista de avisos pendentes do backoffice.
// Cada alerta tem link pra ação (ex: /admin/ativar) e botão "Marcar lida".

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Alerta = {
  id: string
  tipo: string
  titulo: string
  mensagem: string | null
  link: string | null
  lida: boolean
  lida_em: string | null
  lida_por: string | null
  criado_em: string
  detalhes: Record<string, unknown> | null
}

export default function AlertasPage() {
  const [items, setItems] = useState<Alerta[]>([])
  const [mostrarLidas, setMostrarLidas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    try {
      const params = mostrarLidas ? '' : '?lida=false'
      const res = await fetch(`/api/admin/alertas${params}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) { setCarregando(false); return }
      const d = await res.json()
      setItems(d.items || [])
    } catch { /* */ }
    setCarregando(false)
  }
  useEffect(() => { carregar() }, [mostrarLidas]) // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarLida(id: string, lida = true) {
    setMarcando(id)
    try {
      await fetch('/api/admin/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, lida }),
      })
      setItems(prev => prev.map(a => a.id === id ? { ...a, lida } : a))
      if (!mostrarLidas && lida) {
        setItems(prev => prev.filter(a => a.id !== id))
      }
    } catch { /* */ }
    setMarcando(null)
  }

  async function marcarTodas() {
    if (!confirm('Marcar TODAS como lidas?')) return
    try {
      await fetch('/api/admin/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tudo: true }),
      })
      carregar()
    } catch { /* */ }
  }

  function fmtData(iso: string) {
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div className="al2-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="al2-top">
        <Link href="/admin" className="al2-ghost">← Admin</Link>
        <h1>🔔 Alertas</h1>
        <button onClick={marcarTodas} className="al2-ghost" type="button">Marcar todas lidas</button>
      </div>

      <div className="al2-filter">
        <label>
          <input type="checkbox" checked={mostrarLidas} onChange={e => setMostrarLidas(e.target.checked)} />
          Mostrar também já lidas
        </label>
      </div>

      {carregando && <div className="al2-empty">Carregando…</div>}
      {!carregando && items.length === 0 && (
        <div className="al2-empty">
          🎉 Nenhum alerta pendente. Tudo em ordem.
        </div>
      )}

      <div className="al2-list">
        {items.map(a => (
          <div key={a.id} className={`al2-item ${a.lida ? 'lida' : ''}`}>
            <div className="al2-item-body">
              <div className="al2-item-titulo">{a.titulo}</div>
              {a.mensagem && <div className="al2-item-msg">{a.mensagem}</div>}
              <div className="al2-item-meta">
                {fmtData(a.criado_em)}
                {a.lida && a.lida_por && ` · lida por ${a.lida_por}`}
              </div>
            </div>
            <div className="al2-item-acoes">
              {a.link && (
                <Link href={a.link} className="al2-btn-go">Abrir →</Link>
              )}
              {!a.lida && (
                <button
                  type="button"
                  onClick={() => marcarLida(a.id)}
                  disabled={marcando === a.id}
                  className="al2-btn-lida"
                >
                  {marcando === a.id ? '…' : '✓ Lida'}
                </button>
              )}
              {a.lida && (
                <button
                  type="button"
                  onClick={() => marcarLida(a.id, false)}
                  disabled={marcando === a.id}
                  className="al2-btn-naolida"
                >
                  Marcar não lida
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CSS = `
.al2-wrap { font-family: 'Montserrat', 'Inter', system-ui, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px 20px 60px; color: #0F172A; }
.al2-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.al2-top h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -.3px; }
.al2-filter { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #475569; }
.al2-filter input { margin-right: 8px; vertical-align: middle; }
.al2-list { display: flex; flex-direction: column; gap: 10px; }
.al2-item { background: #FEF2F2; border: 1px solid #FCA5A5; border-left: 4px solid #DC2626; border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.al2-item.lida { background: #fff; border-color: #E2E8F0; border-left-color: #94A3B8; }
.al2-item-body { flex: 1; min-width: 200px; }
.al2-item-titulo { font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
.al2-item-msg { font-size: 12.5px; color: #475569; margin-bottom: 6px; line-height: 1.45; }
.al2-item-meta { font-size: 11px; color: #94A3B8; font-variant-numeric: tabular-nums; }
.al2-item-acoes { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.al2-btn-go { background: #DC2626; color: #fff; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; text-decoration: none; }
.al2-btn-go:hover { background: #B91C1C; }
.al2-btn-lida { background: #fff; color: #15803D; border: 1px solid #86EFAC; padding: 7px 12px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; font-family: inherit; }
.al2-btn-naolida { background: #fff; color: #64748B; border: 1px solid #E2E8F0; padding: 7px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; font-family: inherit; }
.al2-empty { padding: 60px 20px; text-align: center; color: #64748B; font-size: 14px; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1; }
`
