'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Resumo = {
  landing_total: number
  landing_unicos?: number
  register_total: number
  register_unicos?: number
  total?: number
  conversao_pct?: number
  conversao_landing_para_register_pct?: number
}

type Dados = {
  hoje: Resumo
  ultimos_7d: Resumo
  ultimos_30d: Resumo
  por_dia_7d: Array<{ dia: string; landing: number; register: number; conversao_pct: number }>
  por_hora_24h: Array<{ hora: string; landing: number; register: number }>
  por_dispositivo_24h: { mobile: number; desktop: number; tablet: number }
  referrers_top_7d: Array<{ host: string; visitas: number }>
  total_24h: number
}

type Periodo = 'hoje' | '7d' | '30d'

function fmtDia(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}`
}

function fmtHora(h: string): string {
  // 'YYYY-MM-DDTHH:00' → 'DD/MM HH:00'
  const dt = h.split('T')
  if (dt.length !== 2) return h
  const [y, m, day] = dt[0].split('-')
  return `${day}/${m} ${dt[1]}`
}

export default function AdminVisitasPage() {
  const router = useRouter()
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [checando, setChecando] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('hoje')

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d?.autenticado) setAutenticado(true)
        else router.replace('/admin')
      })
      .catch(() => router.replace('/admin'))
      .finally(() => setChecando(false))
  }, [router])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/visitas', { cache: 'no-store', credentials: 'include' })
      if (r.ok) setDados(await r.json())
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { if (autenticado) carregar() }, [autenticado, carregar])

  if (checando || !autenticado) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#777' }}>Carregando...</div>
  }
  if (loading || !dados) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#777' }}>Carregando dados...</div>
  }

  const maxPorDia = Math.max(...dados.por_dia_7d.map(d => Math.max(d.landing, d.register)), 1)
  const maxPorHora = Math.max(...dados.por_hora_24h.map(h => Math.max(h.landing, h.register)), 1)
  const totalDispositivo = dados.por_dispositivo_24h.mobile + dados.por_dispositivo_24h.desktop + dados.por_dispositivo_24h.tablet

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto', fontFamily: '-apple-system,"Inter",sans-serif' }}>
      <Link href="/admin" style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>← Voltar ao Admin</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: '#1A1A1A' }}>
            📊 Visitas e Funil
          </h1>
          <div style={{ fontSize: 13, color: '#777' }}>
            Tráfego das páginas de captação: landing + cadastro
          </div>
        </div>
        <button onClick={carregar} style={{ padding: '8px 16px', background: '#1A1A1A', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          🔄 Atualizar
        </button>
      </div>

      {/* Tabs de período */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { id: 'hoje', label: 'Hoje' },
          { id: '7d', label: 'Últimos 7 dias' },
          { id: '30d', label: 'Últimos 30 dias' },
        ] as { id: Periodo; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setPeriodo(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: periodo === t.id ? '2px solid #1A1A1A' : '1px solid #DDD',
              background: periodo === t.id ? '#1A1A1A' : 'white',
              color: periodo === t.id ? 'white' : '#555',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumo do período selecionado */}
      {(() => {
        const r = periodo === 'hoje' ? dados.hoje : periodo === '7d' ? dados.ultimos_7d : dados.ultimos_30d
        const conv = r.conversao_pct ?? r.conversao_landing_para_register_pct ?? 0
        const labelPeriodo = periodo === 'hoje' ? 'HOJE' : periodo === '7d' ? 'ÚLTIMOS 7 DIAS' : 'ÚLTIMOS 30 DIAS'
        return (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 10, marginTop: 4 }}>{labelPeriodo}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
              <Stat label="Visitas landing" valor={r.landing_total} sub={r.landing_unicos !== undefined ? `${r.landing_unicos} únicos` : ''} cor="#1E40AF" bg="#DBEAFE" />
              <Stat label="Visitas cadastro" valor={r.register_total} sub={r.register_unicos !== undefined ? `${r.register_unicos} únicos` : ''} cor="#15803D" bg="#DCFCE7" />
              <Stat label="Conversão" valor={`${conv}%`} sub="landing → cadastro" cor="#9B2C5A" bg="#FDE8EE" />
              <Stat label="Total" valor={(r.total ?? (r.landing_total + r.register_total))} sub="todas as páginas" cor="#92400E" bg="#FEF3C7" />
            </div>
          </>
        )
      })()}

      {/* GRÁFICO 7 DIAS */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 10 }}>📅 ÚLTIMOS 7 DIAS</h3>
      <div style={{ background: '#fff', border: '1px solid #EEE', borderRadius: 12, padding: 18, marginBottom: 28 }}>
        {dados.por_dia_7d.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sem visitas ainda</div>
        ) : (
          dados.por_dia_7d.map(d => (
            <div key={d.dia} style={{ marginBottom: 14, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong>{fmtDia(d.dia)}</strong>
                <span style={{ color: '#777' }}>{d.landing} landing · {d.register} cadastro · {d.conversao_pct}% conv</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div title={`Landing: ${d.landing}`} style={{ flex: d.landing, height: 10, background: '#3B82F6', borderRadius: 3, minWidth: d.landing > 0 ? 3 : 0 }} />
                <div title={`Cadastro: ${d.register}`} style={{ flex: d.register, height: 10, background: '#10B981', borderRadius: 3, minWidth: d.register > 0 ? 3 : 0 }} />
                <div style={{ flex: maxPorDia - d.landing - d.register, height: 10 }} />
              </div>
            </div>
          ))
        )}
        <div style={{ marginTop: 14, fontSize: 12, color: '#999', display: 'flex', gap: 16 }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#3B82F6', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Landing</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#10B981', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Cadastro</span>
        </div>
      </div>

      {/* GRÁFICO 24H POR HORA */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 10 }}>⏰ ÚLTIMAS 24H (por hora)</h3>
      <div style={{ background: '#fff', border: '1px solid #EEE', borderRadius: 12, padding: 18, marginBottom: 28, overflowX: 'auto' }}>
        {dados.por_hora_24h.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>Sem visitas nas últimas 24h</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minWidth: dados.por_hora_24h.length * 24, height: 140 }}>
            {dados.por_hora_24h.map(h => {
              const totalHora = h.landing + h.register
              const altura = (totalHora / maxPorHora) * 100
              return (
                <div key={h.hora} title={`${fmtHora(h.hora)}\nLanding: ${h.landing}\nCadastro: ${h.register}`} style={{ flex: 1, minWidth: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', height: '100%' }}>
                    <div style={{ width: '100%', height: `${(h.landing / maxPorHora) * 100}%`, background: '#3B82F6' }} />
                    <div style={{ width: '100%', height: `${(h.register / maxPorHora) * 100}%`, background: '#10B981' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#999', marginTop: 4, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
                    {h.hora.split('T')[1].slice(0, 2)}h
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DISPOSITIVO + REFERRERS lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#fff', border: '1px solid #EEE', borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 14 }}>📱 DISPOSITIVO (24h)</h3>
          {totalDispositivo === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>Sem dados</div>
          ) : (
            ['mobile', 'desktop', 'tablet'].map(k => {
              const v = (dados.por_dispositivo_24h as Record<string, number>)[k]
              const pct = totalDispositivo > 0 ? (v / totalDispositivo) * 100 : 0
              const cores: Record<string, string> = { mobile: '#9B2C5A', desktop: '#1E40AF', tablet: '#15803D' }
              return (
                <div key={k} style={{ marginBottom: 12, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ textTransform: 'capitalize' }}>{k}</strong>
                    <span style={{ color: '#777' }}>{v} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cores[k] }} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #EEE', borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 14 }}>🔗 ORIGEM (7d)</h3>
          {dados.referrers_top_7d.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: 16, fontSize: 13 }}>
              Sem referrer ainda. Aparece quando alguém clica em link de outro site (Instagram, WhatsApp Web, etc).
            </div>
          ) : (
            dados.referrers_top_7d.map(r => (
              <div key={r.host} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #F5F5F5' }}>
                <span style={{ color: '#1A1A1A' }}>{r.host}</span>
                <strong style={{ color: '#9B2C5A' }}>{r.visitas}</strong>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, valor, sub, cor, bg }: { label: string; valor: string | number; sub: string; cor: string; bg: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${cor}30`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: cor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 28, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>{sub}</div>
    </div>
  )
}
