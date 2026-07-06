'use client'

// Mapa de cadastros por estado (tile-grid choropleth). Cada UF é uma peça
// na sua posição geográfica aproximada, colorida pela quantidade de
// revendedoras cadastradas. Leve, sem dependências de mapa.

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Posição [coluna, linha] de cada UF num grid 7 colunas (formato Brasil).
const UF_GRID: Record<string, [number, number]> = {
  RR: [2, 0], AP: [3, 0],
  AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
  AC: [0, 2], RO: [1, 2], TO: [3, 2], PI: [4, 2], PB: [5, 2],
  MT: [2, 3], DF: [3, 3], BA: [4, 3], PE: [5, 3], AL: [6, 3],
  MS: [2, 4], GO: [3, 4], MG: [4, 4], SE: [5, 4],
  SP: [3, 5], RJ: [4, 5], ES: [5, 5],
  PR: [3, 6], SC: [3, 7], RS: [3, 8],
}

type Dados = {
  porUF: Record<string, { total: number; ativas: number }>
  total: number
  semUF: number
}

export default function AdminMapaPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch('/api/admin/cadastros-por-estado', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setDados)
      .catch(() => setErro(true))
      .finally(() => setCarregando(false))
  }, [])

  const porUF = dados?.porUF || {}
  const max = Math.max(1, ...Object.values(porUF).map(v => v.total))

  function corTile(total: number): { bg: string; fg: string } {
    if (!total) return { bg: '#F1F5F9', fg: '#94A3B8' }
    const i = total / max
    // Escala rosa da marca.
    const bg = `rgba(232,57,106,${(0.18 + 0.82 * i).toFixed(2)})`
    return { bg, fg: i > 0.45 ? '#fff' : '#7A1733' }
  }

  const ranking = Object.entries(porUF)
    .map(([uf, v]) => ({ uf, ...v }))
    .sort((a, b) => b.total - a.total)

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '20px 16px 60px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/admin" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>← Voltar ao Admin</Link>

        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '12px 0 4px' }}>
          🗺️ Cadastros por estado
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
          Quantas revendedoras se cadastraram em cada estado do Brasil.
        </p>

        {carregando && <div style={{ color: '#64748B', fontSize: 14 }}>Carregando…</div>}
        {erro && <div style={{ color: '#DC2626', fontSize: 14 }}>Erro ao carregar (você está logada no admin?).</div>}

        {dados && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>Total cadastros</div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 26, fontWeight: 900, color: '#E8396A' }}>{dados.total}</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>Estados com cadastro</div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 26, fontWeight: 900, color: '#0F172A' }}>{ranking.length}</div>
              </div>
              {dados.semUF > 0 && (
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>Sem estado válido</div>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 26, fontWeight: 900, color: '#94A3B8' }}>{dados.semUF}</div>
                </div>
              )}
            </div>

            {/* Mapa tile-grid */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, marginBottom: 20, overflowX: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 5,
                  maxWidth: 420,
                  margin: '0 auto',
                }}
              >
                {Object.entries(UF_GRID).map(([uf, [col, row]]) => {
                  const v = porUF[uf]?.total || 0
                  const { bg, fg } = corTile(v)
                  return (
                    <div
                      key={uf}
                      title={`${uf}: ${v} cadastro(s)${porUF[uf] ? ` · ${porUF[uf].ativas} ativa(s)` : ''}`}
                      style={{
                        gridColumn: col + 1,
                        gridRow: row + 1,
                        aspectRatio: '1 / 1',
                        background: bg,
                        color: fg,
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        padding: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 800 }}>{uf}</span>
                      <span style={{ fontSize: 13, fontWeight: 900, marginTop: 2 }}>{v}</span>
                    </div>
                  )
                })}
              </div>

              {/* Legenda */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, fontSize: 11, color: '#64748B' }}>
                <span>menos</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0.18, 0.4, 0.6, 0.8, 1].map(i => (
                    <div key={i} style={{ width: 18, height: 12, borderRadius: 3, background: `rgba(232,57,106,${i})` }} />
                  ))}
                </div>
                <span>mais</span>
              </div>
            </div>

            {/* Ranking */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
                Ranking por estado
              </div>
              {ranking.length === 0 && <div style={{ fontSize: 13, color: '#64748B' }}>Nenhum cadastro com estado ainda.</div>}
              {ranking.map(r => (
                <div key={r.uf} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 30, fontWeight: 800, color: '#E8396A', fontSize: 13 }}>{r.uf}</div>
                  <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${(r.total / max) * 100}%`, height: '100%', background: '#E8396A', borderRadius: 6 }} />
                  </div>
                  <div style={{ width: 64, textAlign: 'right', fontSize: 12, color: '#475569' }}>
                    <strong style={{ color: '#0F172A' }}>{r.total}</strong> · {r.ativas} ativa(s)
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
