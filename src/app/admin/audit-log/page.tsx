'use client'

// /admin/audit-log — quem fez o quê e quando.
// Filtro por pessoa (gabby/anderson/escritorio/master) e por ação.
// Server-side paginação via ?limit=N (default 200, max 500).

import { useEffect, useState } from 'react'
import Link from 'next/link'

type LogItem = {
  id: string
  quem: string
  acao: string
  alvo: string | null
  detalhes: Record<string, unknown> | null
  ip: string | null
  criado_em: string
}

const LABEL: Record<string, { nome: string; cor: string }> = {
  gabby: { nome: 'Gabby', cor: '#E8396A' },
  anderson: { nome: 'Anderson', cor: '#6366F1' },
  escritorio: { nome: 'Escritório', cor: '#22C55E' },
  master: { nome: 'Master', cor: '#9333EA' },
}

export default function AuditLogPage() {
  const [items, setItems] = useState<LogItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtroQuem, setFiltroQuem] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const params = new URLSearchParams()
      if (filtroQuem) params.set('quem', filtroQuem)
      if (filtroAcao) params.set('acao', filtroAcao)
      params.set('limit', '300')
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Falha ao carregar')
      const d = await res.json()
      setItems(d.items || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const acoesDistintas = Array.from(new Set(items.map(i => i.acao))).sort()

  function formatarData(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div className="al-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="al-top">
        <Link href="/admin" className="al-ghost">← Admin</Link>
        <h1>📜 Auditoria</h1>
        <div style={{ width: 80 }} />
      </div>

      <p className="al-sub">
        Registro de todas as ações feitas no backoffice por cada usuário.
      </p>

      <div className="al-filters">
        <select value={filtroQuem} onChange={e => setFiltroQuem(e.target.value)}>
          <option value="">Todos usuários</option>
          <option value="gabby">Gabby</option>
          <option value="anderson">Anderson</option>
          <option value="escritorio">Escritório</option>
          <option value="master">Master</option>
        </select>
        <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}>
          <option value="">Todas ações</option>
          {acoesDistintas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={carregar}>Aplicar</button>
      </div>

      {carregando && <div className="al-empty">Carregando…</div>}
      {erro && <div className="al-empty al-err">{erro}</div>}
      {!carregando && !erro && items.length === 0 && (
        <div className="al-empty">Nenhum registro ainda.</div>
      )}

      {!carregando && items.length > 0 && (
        <div className="al-table">
          <div className="al-row al-head">
            <div>Quando</div>
            <div>Quem</div>
            <div>Ação</div>
            <div>Alvo</div>
            <div>Detalhes</div>
          </div>
          {items.map(i => {
            const info = LABEL[i.quem] || { nome: i.quem, cor: '#475569' }
            return (
              <div key={i.id} className="al-row">
                <div className="al-date">{formatarData(i.criado_em)}</div>
                <div>
                  <span className="al-pill" style={{ background: `${info.cor}15`, color: info.cor, borderColor: `${info.cor}55` }}>
                    {info.nome}
                  </span>
                </div>
                <div className="al-acao">{i.acao}</div>
                <div className="al-alvo">{i.alvo || '—'}</div>
                <div className="al-det">
                  {i.detalhes ? (
                    <code>{JSON.stringify(i.detalhes)}</code>
                  ) : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const CSS = `
.al-wrap {
  font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 60px;
  color: #0F172A;
}
.al-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.al-top h1 { margin: 0; font-size: 22px; font-weight: 800; letterSpacing: -0.3px; }
.al-sub { color: #64748B; font-size: 13px; margin: 0 0 18px; }
.al-filters {
  display: flex; gap: 8px; flex-wrap: wrap;
  background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;
  padding: 12px; margin-bottom: 16px;
}
.al-filters select, .al-filters button {
  font-family: inherit; font-size: 13px; padding: 8px 12px;
  border-radius: 8px; border: 1px solid #CBD5E1; background: #fff;
}
.al-filters button {
  background: #6366F1; color: #fff; border-color: #6366F1; font-weight: 700; cursor: pointer;
}
.al-filters button:hover { background: #4F46E5; }
.al-table { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.al-row {
  display: grid;
  grid-template-columns: 110px 100px 1fr 1.2fr 1.8fr;
  gap: 12px; padding: 10px 14px; border-bottom: 1px solid #F1F5F9;
  font-size: 12.5px; align-items: center;
}
.al-row:last-child { border-bottom: 0; }
.al-head { background: #F8FAFC; font-weight: 700; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: .5px; }
.al-date { color: #475569; font-variant-numeric: tabular-nums; }
.al-pill { display: inline-block; padding: 3px 8px; border: 1px solid; border-radius: 999px; font-size: 11px; font-weight: 700; }
.al-acao { font-family: 'SF Mono', Menlo, monospace; font-size: 11.5px; color: #0F172A; }
.al-alvo { font-family: 'SF Mono', Menlo, monospace; font-size: 11px; color: #64748B; overflow: hidden; text-overflow: ellipsis; }
.al-det code { font-size: 10.5px; color: #6366F1; background: #EEF2FF; padding: 2px 6px; border-radius: 4px; word-break: break-all; display: inline-block; max-height: 60px; overflow: hidden; }
.al-empty { padding: 60px 20px; text-align: center; color: #94A3B8; font-size: 14px; }
.al-err { color: #DC2626; }
@media (max-width: 800px) {
  .al-row { grid-template-columns: 1fr; gap: 4px; padding: 12px; }
  .al-head { display: none; }
  .al-row > div::before {
    content: attr(data-l);
    display: block; font-size: 10px; color: #94A3B8;
    font-weight: 700; text-transform: uppercase;
  }
}
`
