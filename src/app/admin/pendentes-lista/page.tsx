'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// PÁGINA TEMPORÁRIA — URL NOVA pra contornar cache da Vercel que segurava
// /admin/ativar com dados antigos. Funcionalidade idêntica ao /admin/ativar.

type RevPendente = {
  id: string
  nome: string
  email: string
  whatsapp: string
  cidade: string
  estado: string
  criado_em: string
}

export default function PendentesListaPage() {
  const router = useRouter()
  const [autenticado, setAutenticado] = useState(false)
  const [checando, setChecando] = useState(true)
  const [pendentes, setPendentes] = useState<RevPendente[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [ativando, setAtivando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')

  // Auth via cookie (server confere via /api/admin/session)
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

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch(`/api/admin/pendentes?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!res.ok) {
        setErro(`HTTP ${res.status}`)
        setPendentes([])
        return
      }
      const data = await res.json()
      setPendentes(Array.isArray(data) ? data : [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'erro')
      setPendentes([])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (autenticado) carregar()
  }, [autenticado])

  async function ativar(id: string, nome: string) {
    if (!confirm(`Confirmar ativação de ${nome}?\n\nConfirma no PagBank que R$ 39,90 chegou.`)) return
    setAtivando(id)
    try {
      const res = await fetch('/api/admin/ativar-revendedora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ revendedora_id: id, nome }),
      })
      if (!res.ok) {
        setMensagem(`❌ Erro: HTTP ${res.status}`)
        return
      }
      setMensagem(`✅ ${nome} ativada!`)
      setTimeout(() => setMensagem(''), 4000)
      await carregar()
    } catch (e) {
      setMensagem(`❌ ${e instanceof Error ? e.message : 'erro'}`)
    } finally {
      setAtivando(null)
    }
  }

  if (checando || !autenticado) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#777' }}>Carregando...</div>
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto', fontFamily: '-apple-system, "Inter", sans-serif' }}>
      <Link href="/admin" style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>
        ← Voltar ao Admin
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 12, marginBottom: 4, color: '#1A1A1A' }}>
        Revendedoras pendentes
      </h1>
      <p style={{ fontSize: 13, color: '#777', marginBottom: 20 }}>
        URL nova (cache-free). Mesma função de /admin/ativar.
      </p>

      <button
        onClick={carregar}
        style={{ marginBottom: 20, padding: '8px 16px', background: '#1A1A1A', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
      >
        🔄 Recarregar
      </button>

      {mensagem && (
        <div style={{ padding: 12, marginBottom: 16, background: mensagem.startsWith('✅') ? '#DCFCE7' : '#FEE2E2', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
          {mensagem}
        </div>
      )}

      {erro && (
        <div style={{ padding: 12, marginBottom: 16, background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 13 }}>
          Erro ao carregar: {erro}
        </div>
      )}

      {carregando ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Carregando...</div>
      ) : pendentes.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#FAFAFA', borderRadius: 12, border: '1px solid #EEE' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
          <div style={{ fontWeight: 700, color: '#1A1A1A' }}>Nenhuma pendente</div>
          <div style={{ fontSize: 13, color: '#777', marginTop: 6 }}>
            Se vc esperava ver Anderson aqui e ele NÃO apareceu, manda print pra Claude.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#15803D', fontWeight: 700 }}>
            {pendentes.length} pendente{pendentes.length === 1 ? '' : 's'}
          </div>
          {pendentes.map(r => (
            <div key={r.id} style={{ background: 'white', border: '1px solid #EEE', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{r.nome}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  📧 {r.email}<br/>
                  📱 {r.whatsapp} · 📍 {r.cidade}/{r.estado}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  Cadastrou: {new Date(r.criado_em).toLocaleString('pt-BR')}
                </div>
              </div>
              <button
                onClick={() => ativar(r.id, r.nome)}
                disabled={ativando === r.id}
                style={{
                  background: '#10B981', color: 'white', border: 'none', borderRadius: 8,
                  padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  opacity: ativando === r.id ? 0.5 : 1,
                }}
              >
                {ativando === r.id ? 'Ativando...' : '✅ Ativar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
